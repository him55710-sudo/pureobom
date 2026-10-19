// UI fixture: actual built extension UI/worker, simulated editor. No private source.
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Worker } from "node:worker_threads";
const rust = process.argv.includes("--rust");
const focus = process.argv.includes("--focus");
const folder = resolve(
  focus
    ? "test-results/focused-explanation-ui"
    : rust
      ? "test-results/rust-source-ui"
      : "test-results/function-format-ui",
);
const path = rust ? "sample.rs" : "sample.ts";
await mkdir(folder, { recursive: true });
const worker = new Worker(resolve("extension/out/worker.cjs"));
let seq = 0,
  version = 1,
  proposal,
  observation,
  reviewed = false;
let source = rust
  ? '// 😀 Unicode anchors\nconst LIMIT: u64 = 9007199254740993u64;\npub fn label(count: u32) -> &\'static str {\n    match count {\n        0 => r#"아직 없음"#,\n        n if n < 10 => "a few",\n        _ => "many",\n    }\n}\n'
  : "export function total(rows: number[]) { let amount=0, index=0; while(index<rows.length) { amount+=rows[index]; index++; } return amount; }\nconst untouched=()=>2;\n";
const calls = [],
  pending = new Map();
worker.on("message", (response) => {
  const p = pending.get(response.id);
  if (!p) return;
  pending.delete(response.id);
  clearTimeout(p.timer);
  response.error ? p.reject(Error(response.error)) : p.resolve(response.result);
});
worker.on("error", (error) => {
  for (const p of pending.values()) {
    clearTimeout(p.timer);
    p.reject(error);
  }
  pending.clear();
});
function call(type, payload) {
  return new Promise((resolve, reject) => {
    const id = ++seq,
      timer = setTimeout(() => {
        pending.delete(id);
        reject(Error("Worker timed out"));
      }, 20000);
    pending.set(id, { resolve, reject, timer });
    worker.postMessage({ id, type, payload });
  });
}
async function state() {
  const analysis = rust
    ? await call("rust", { file: { path, content: source }, action: "analyze" })
    : (await call("analyze", { files: [{ path, content: source }] })).files[0];
  return {
    contextId: String(version),
    version,
    path,
    language: rust ? "rust" : "typescript",
    sourceBytes: Buffer.byteLength(source),
    dirty: version > 1,
    trusted: true,
    busy: false,
    analysis,
  };
}
async function rpc(r) {
  calls.push(r);
  await writeFile(
    resolve(folder, "calls.json"),
    JSON.stringify(calls, null, 2),
  );
  if (r.action === "ready") return { state: await state() };
  if (r.action === "localModels" && focus)
    return {
      result: {
        origin: "Controlled UI fixture; no model inference",
        models: [{ name: "fixture:local", digest: "a".repeat(64), size: 0 }],
      },
    };
  if (r.contextId !== String(version)) throw Error("Stale fixture context");
  if (r.action === "localObserve" && focus) {
    const fn = (await state()).analysis.functions.find(
      (f) => f.id === r.payload.focusFunctionId,
    );
    if (!fn) throw Error("Select a function for this UI fixture");
    const items = await call("observe", {
      files: [{ path, content: source }],
      path,
      focus: { name: fn.name, start: fn.start, end: fn.end },
      inputs: r.payload.inputs,
    });
    observation = { id: `observation-${seq}`, items };
    return { result: observation };
  }
  if (r.action === "localGenerate" && focus) {
    const a = (await state()).analysis;
    const fn = a.functions.find((f) => f.id === r.payload.focusFunctionId);
    if (!fn || r.payload.task !== "explain")
      throw Error("Select a function for this UI fixture");
    const ko = r.payload.lang === "ko",
      quoted = source.slice(fn.start, fn.end);
    return {
      result: {
        id: "focus-fixture",
        model: "fixture:local",
        digest: "a".repeat(64),
        elapsedMs: 1,
        processor: r.payload.processor || "auto",
        summary: ko
          ? "선택한 함수의 설명을 표시하는 화면 검증용 응답입니다. 실제 모델의 설명 품질 검증이 아닙니다."
          : "Controlled response for verifying the selected-function display. This does not evaluate a real model.",
        citations: [
          {
            quote: quoted,
            explanation: ko
              ? "선택한 함수의 원문입니다."
              : "Source of the selected function.",
            start: fn.start,
            end: fn.end,
            line: fn.line,
          },
        ],
        edits: [],
        risks: [],
        checks: [],
        focus: { name: fn.name, line: fn.line, endLine: fn.endLine },
        ...(r.payload.observationId === observation?.id && observation
          ? { observations: observation.items }
          : {}),
        validation: { status: "unavailable", detail: "No proposed change" },
      },
    };
  }
  if (r.action === "localSource" && focus) return { result: {} };
  if (r.action === "prepare" && rust) {
    proposal = await call("rust", {
      file: { path, content: source },
      action: "patch",
      ruleId: r.payload.ruleId,
      value: r.payload.value,
    });
    reviewed = false;
    return {
      result: {
        id: "rust-fixture",
        description: proposal.description,
        oldText: proposal.oldText,
        newText: proposal.newText,
      },
    };
  }
  if (r.action === "formatFunction") {
    const result = await call("formatFunction", {
      file: { path: "sample.ts", content: source },
      functionId: r.payload.functionId,
    });
    reviewed = false;
    proposal = result.patch;
    return {
      result: proposal
        ? {
            id: "format-fixture",
            kind: "function-format",
            description: proposal.description,
            oldText: proposal.oldText,
            newText: proposal.newText,
          }
        : { unchanged: true, description: result.description },
    };
  }
  if (r.action === "preview") {
    if (!proposal) throw Error("No proposal");
    reviewed = true;
    return { result: {} };
  }
  if (r.action === "apply") {
    if (!proposal || !reviewed) throw Error("Review required");
    source = proposal.updated;
    proposal = undefined;
    version++;
    return { result: { applied: true }, state: await state() };
  }
  if (r.action === "source") return { result: {} };
  throw Error("Unsupported fixture action: " + r.action);
}
const fixtureTitle = focus
  ? "Focused explanation"
  : rust
    ? "Rust source"
    : "Function layout";
const page = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${fixtureTitle} UI verification</title><link rel="stylesheet" href="/view.css"><link rel="stylesheet" href="/theme.css"><body><p style="padding:12px;margin:0;background:#fff4d4;color:#433716">UI verification fixture — actual extension UI and worker; simulated editor, public sample code.${focus ? " Controlled model replies; no model inference." : ""}</p><div id="root"></div><script>window.acquireVsCodeApi=()=>({getState:()=>({}),setState:()=>{},postMessage:async m=>{const r=await(await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(m)})).json();if(r.state)window.postMessage({type:'state',state:r.state},location.origin);window.postMessage({type:'response',id:m.id,result:r.result,error:r.error},location.origin)}});</script><script src="/view.js"></script></body></html>`;
const server = createServer(async (req, res) => {
  try {
    if (req.url === "/rpc" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 10000) throw Error("Too large");
      }
      let response;
      try {
        response = await rpc(JSON.parse(body));
      } catch (e) {
        response = { error: e.message };
      }
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(response));
    } else if (["/view.js", "/view.css", "/theme.css"].includes(req.url)) {
      res.setHeader(
        "content-type",
        req.url.endsWith("css") ? "text/css" : "text/javascript",
      );
      res.end(
        await readFile(
          req.url === "/theme.css"
            ? "scripts/fixtures/function-format/theme.css"
            : resolve("extension/media", req.url.slice(1)),
        ),
      );
    } else if (req.url === "/") {
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(page);
    } else {
      res.statusCode = 404;
      res.end();
    }
  } catch (error) {
    res.statusCode = 500;
    res.end(String(error));
  }
});
server.on("error", async (error) => {
  console.error(error);
  await worker.terminate();
  process.exitCode = 1;
});
server.listen(0, "127.0.0.1", () =>
  console.log(
    `${fixtureTitle} UI fixture: http://127.0.0.1:${server.address().port}`,
  ),
);
