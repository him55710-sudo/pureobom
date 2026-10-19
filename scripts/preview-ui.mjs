// Local browser harness for inspecting the real extension UI. VS Code operations
// are simulated here; source analysis, patches and scenarios use the real worker.
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import { resolve } from "node:path";
import { build } from "esbuild";
const demoBundle = await build({
  entryPoints: ["src/demo.ts"],
  bundle: true,
  format: "esm",
  write: false,
});
const { demo } = await import(
  `data:text/javascript;base64,${Buffer.from(demoBundle.outputFiles[0].text).toString("base64")}`
);
const values = process.argv.includes("--values");
const iteration = process.argv.includes("--iteration");
const transportBundle = await build({
  entryPoints: ["src/core/previewValues.ts"],
  bundle: true,
  format: "esm",
  write: false,
});
const { encodePreviewMessage, decodePreviewMessage, usesPreviewTransport } =
  await import(
    `data:text/javascript;base64,${Buffer.from(transportBundle.outputFiles[0].text).toString("base64")}`
  );
const files = iteration
  ? [
      {
        path: "iteration.ts",
        content:
          "const scale=2; export function calculate(count:number){let i=0,total=0;while(i<count){i++;if(i===2)continue;total+=i;}const values=[total,count].map(x=>x*scale);return {values,last:values.at(-1)};}",
      },
    ]
  : values
    ? [
        {
          path: "values.ts",
          content:
            'export function calculate(input: number) { return { input, ratio: input / input, reciprocal: 1 / input, absent: undefined, literal: null, text: "NaN", negativeZero: -0, nested: [undefined, "[NaN]"] }; }\n',
        },
      ]
    : structuredClone(demo);
const worker = new Worker(resolve("extension/out/worker.cjs"));
let seq = 0,
  version = 1,
  active = files[0],
  patch,
  project;
const pending = new Map();
worker.on("message", ({ id, result, error }) => {
  const p = pending.get(id);
  pending.delete(id);
  if (p) error ? p.reject(Error(error)) : p.resolve(result);
});
const call = (type, payload) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, type, payload });
  });
async function state() {
  project = await call("analyze", { files });
  return {
    contextId: String(version),
    path: active.path,
    language: "typescript",
    version,
    dirty: version > 1,
    trusted: true,
    busy: false,
    analysis: project.files.find((f) => f.path === active.path),
    project,
  };
}
async function rpc(r) {
  if (usesPreviewTransport(r.action))
    r.payload = decodePreviewMessage(r.payload);
  let result, next;
  if (["ready", "refresh", "example", "scan"].includes(r.action))
    next = await state();
  else if (r.action === "select") {
    active = files.find((f) => f.path === r.payload.path) || active;
    version++;
    next = await state();
  } else if (r.action === "prepare") {
    if (r.contextId !== String(version)) throw Error("Stale preview");
    patch = await call(r.payload.request ? "request" : "patch", {
      ...r.payload,
      file: active,
    });
    result = {
      id: String(version),
      description: patch.description,
      oldText: patch.oldText,
      newText: patch.newText,
    };
  } else if (r.action === "apply") {
    if (r.contextId !== String(version) || patch?.original !== active.content)
      throw Error("Stale preview");
    active.content = patch.updated;
    patch = undefined;
    version++;
    next = await state();
  } else if (r.action === "compare")
    result = await call("compare", {
      ...r.payload,
      path: active.path,
      files,
      patch: r.payload.patchId ? patch : undefined,
    });
  else if (r.action === "simulate")
    result = await call("simulate", {
      ...r.payload,
      path: active.path,
      files,
      args: JSON.parse(r.payload.args),
    });
  else if (r.action === "source" || r.action === "preview")
    result = { previewOnly: true };
  else if (r.action === "report" && values) {
    await mkdir("test-results/preview-values-ui", { recursive: true });
    await writeFile(
      "test-results/preview-values-ui/report.md",
      r.payload.content,
    );
  } else if (r.action === "projectTasks") result = [];
  else if (r.action === "localModels")
    result = { models: [], origin: "http://127.0.0.1:11434" };
  else
    throw Error("브라우저 UX 미리보기에서는 지원하지 않는 VS Code 작업입니다.");
  return {
    result: usesPreviewTransport(r.action)
      ? encodePreviewMessage(result)
      : result,
    state: next,
  };
}
const page = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>풀어봄 · UX preview</title><link rel="stylesheet" href="/view.css"><style>
html{--vscode-font-family: "Segoe UI", "Malgun Gothic", sans-serif;--vscode-font-size:13px;--vscode-editor-font-family:Consolas,monospace;--vscode-editor-background:#fcfcfa;--vscode-foreground:#253830;--vscode-descriptionForeground:#6e7972;--vscode-panel-border:#dce2dc;--vscode-sideBar-background:#f1f4ef;--vscode-textLink-foreground:#267460;--vscode-button-background:#267460;--vscode-button-foreground:white;--vscode-button-hoverBackground:#1e604e;--vscode-button-secondaryBackground:#ecf1eb;--vscode-button-secondaryForeground:#253830;--vscode-button-secondaryHoverBackground:#e4ebe3;--vscode-input-background:#fff;--vscode-input-foreground:#253830;--vscode-focusBorder:#267460;color-scheme:light}.preview-label{padding:7px 24px;font:10px system-ui;color:#6e7972;background:#edf1eb;border-bottom:1px solid #dce2dc}.app{max-width:1060px}
</style><body class="vscode-light"><div class="preview-label">UI 검증용 미리보기 · 실제 분석 엔진 / VS Code 연결은 모의 구현</div><div id="root"></div><script>
let saved={}; window.acquireVsCodeApi=()=>({getState:()=>saved,setState:v=>saved=v,postMessage:async m=>{try{const r=await(await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(m)})).json();if(r.state)window.postMessage({type:'state',state:r.state},location.origin);window.postMessage({type:'response',id:m.id,result:r.result,error:r.error},location.origin)}catch(e){window.postMessage({type:'response',id:m.id,error:e.message},location.origin)}}});
</script><script src="/view.js"></script></body></html>`;
const server = createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/rpc") {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 100000) throw Error("Too large");
      }
      let response;
      try {
        response = await rpc(JSON.parse(body));
      } catch (e) {
        response = { error: e.message };
      }
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(response));
    } else if (req.url === "/view.js" || req.url === "/view.css") {
      res.setHeader(
        "Content-Type",
        req.url.endsWith("css") ? "text/css" : "text/javascript",
      );
      res.end(await readFile(`extension/media${req.url}`));
    } else if (req.url === "/" || req.url === "/index.html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(page);
    } else {
      res.statusCode = 404;
      res.end();
    }
  } catch (e) {
    res.statusCode = 500;
    res.end(String(e));
  }
});
server.listen(values || iteration ? 0 : 4175, "127.0.0.1", () =>
  console.log(`UX preview: http://127.0.0.1:${server.address().port}`),
);
