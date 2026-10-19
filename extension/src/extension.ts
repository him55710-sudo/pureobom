import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import { Controller, message } from "./controller";
import { AnalysisClient } from "./analysisClient";
import { inputString, requestMessage } from "./protocol";
import type { Scenario } from "../../src/core/scenarioModel";
import { interfaceDemo } from "../../src/interfaceDemo";
import { productResource } from "../../src/product";
import {
  decodePreviewMessage,
  encodePreviewMessage,
  usesPreviewTransport,
} from "../../src/core/previewValues";

export function activate(context: vscode.ExtensionContext) {
  const controller = new Controller(
    new AnalysisClient(context.asAbsolutePath("out/worker.cjs")),
    context.workspaceState,
    context.asAbsolutePath("runtime/python_source.py"),
    {
      script: context.asAbsolutePath("runtime/go_source.go"),
      cache: vscode.Uri.joinPath(context.globalStorageUri, "go-reader").fsPath,
    },
    {
      script: context.asAbsolutePath("runtime/PureobomJavaSource.java"),
      cache: vscode.Uri.joinPath(context.globalStorageUri, "java-reader")
        .fsPath,
    },
    {
      script: context.asAbsolutePath("runtime/PureobomCSharpSource.cs"),
      cache: vscode.Uri.joinPath(context.globalStorageUri, "csharp-reader")
        .fsPath,
    },
  );
  let panel: vscode.WebviewPanel | undefined;
  const refreshEditor = async () => {
    const doc = vscode.window.activeTextEditor?.document;
    if (doc && Controller.accepts(doc)) await controller.setDocument(doc);
    else if (
      doc &&
      !["pureobom-preview", "pureobom-local-preview"].includes(doc.uri.scheme)
    )
      controller.clearDocument();
    else await controller.refresh();
  };
  const openPanel = async () => {
    if (panel) {
      panel.reveal(panel.viewColumn, true);
      await refreshEditor();
      return;
    }
    panel = vscode.window.createWebviewPanel(
      "pureobom.reader",
      "풀어봄 · 코드 설명",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "media"),
        ],
      },
    );
    const currentPanel = panel;
    currentPanel.webview.html = html(
      currentPanel.webview,
      context.extensionUri,
    );
    const changes = controller.changes.event(
      (state) =>
        void currentPanel.webview.postMessage({ type: "state", state }),
    );
    const receiver = currentPanel.webview.onDidReceiveMessage(async (raw) => {
      let id: string | undefined;
      try {
        const r = requestMessage(raw);
        id = r.id;
        const decoded = usesPreviewTransport(r.action)
          ? decodePreviewMessage(r.payload)
          : r.payload || {};
        if (!decoded || typeof decoded !== "object" || Array.isArray(decoded))
          throw Error("Invalid request payload");
        const p = decoded as Record<string, unknown>;
        let result: unknown;
        switch (r.action) {
          case "benchmarkPrepare":
            result = await controller.benchmarks.prepare(
              r.contextId,
              inputString(p.id, 100),
            );
            break;
          case "benchmarkRun":
            result = await controller.benchmarks.start(
              r.contextId,
              inputString(p.id, 100),
              p.phase,
              p.reviewed,
            );
            break;
          case "benchmarkCancel":
            controller.benchmarks.cancel();
            break;
          case "benchmarkReport": {
            const document = await vscode.workspace.openTextDocument({
              language: "json",
              content: JSON.stringify(controller.benchmarks.report(), null, 2),
            });
            await vscode.window.showTextDocument(document, {
              viewColumn: vscode.ViewColumn.One,
              preview: false,
            });
            break;
          }
          case "projectTasks":
            result = await controller.checks.list(r.contextId);
            break;
          case "projectRun":
            result = await controller.checks.start(
              r.contextId,
              inputString(p.id, 100),
              p.reviewed,
            );
            break;
          case "projectCancel":
            controller.checks.cancel();
            break;
          case "localModels":
            result = await controller.assistant.models();
            break;
          case "localGenerate":
            result = await controller.assistant.generate(r.contextId, p);
            break;
          case "localCancel":
            controller.assistant.cancel();
            break;
          case "localPreview":
            result = await controller.assistant.preview(
              inputString(p.id, 100),
              r.contextId,
            );
            break;
          case "localApply":
            result = await controller.assistant.apply(
              inputString(p.id, 100),
              r.contextId,
              p.acknowledgeUnchecked,
            );
            break;
          case "localSource":
            await controller.assistant.source(
              inputString(p.id, 100),
              r.contextId,
              p.index,
            );
            break;
          case "ready":
            await currentPanel.webview.postMessage({
              type: "state",
              state: controller.state,
            });
            break;
          case "refresh":
            await refreshEditor();
            break;
          case "scan":
            await controller.scan();
            break;
          case "prepare":
            result = await controller.prepare(r.contextId, p);
            break;
          case "formatFunction":
            result = await controller.prepareFormat(
              r.contextId,
              inputString(p.functionId, 100),
            );
            break;
          case "sqlDialect":
            await controller.setSqlDialect(r.contextId, p.dialect);
            break;
          case "term":
            if (p.lang !== "ko" && p.lang !== "en")
              throw Error("Invalid language");
            await controller.setTerm(
              r.contextId,
              inputString(p.symbolId, 2048),
              p.lang,
              inputString(p.label, 80),
            );
            break;
          case "preview":
            if (p.lang !== undefined && p.lang !== "ko" && p.lang !== "en")
              throw Error("Invalid language");
            result = await controller.preview(
              inputString(p.id, 100),
              r.contextId,
              p.lang,
            );
            break;
          case "apply":
            result = await controller.apply(
              inputString(p.id, 100),
              r.contextId,
            );
            break;
          case "source":
            await controller.source(r.contextId, p.line);
            break;
          case "traceSource":
            await controller.traceSource(r.contextId, p.traceId, p.index);
            break;
          case "diagnosticSource":
            await controller.diagnosticSource(
              r.contextId,
              inputString(p.revision, 100),
              inputString(p.id, 100),
            );
            break;
          case "select":
            await controller.select(inputString(p.path));
            break;
          case "simulate":
            result = await controller.simulate(
              r.contextId,
              inputString(p.name),
              inputString(p.args),
            );
            break;
          case "compare":
            if (!Array.isArray(p.scenarios)) throw Error("Invalid scenarios");
            result = await controller.compare(
              r.contextId,
              inputString(p.name),
              p.scenarios as Scenario[],
              p.patchId === undefined ? undefined : inputString(p.patchId, 100),
            );
            break;
          case "report": {
            const document = await vscode.workspace.openTextDocument({
              language: "markdown",
              content: inputString(p.content, 250000),
            });
            await vscode.window.showTextDocument(document, {
              viewColumn: vscode.ViewColumn.One,
              preview: false,
            });
            break;
          }
          case "example":
            await vscode.commands.executeCommand("pureobom.example");
            break;
          case "openResource":
            if (
              !(await vscode.env.openExternal(
                vscode.Uri.parse(productResource(p.resource)),
              ))
            )
              throw Error("Could not open the product link");
            break;
          case "copyFeedback":
            await vscode.env.clipboard.writeText(inputString(p.text, 10000));
            break;
          default:
            throw Error("지원하지 않는 요청입니다.");
        }
        await currentPanel.webview.postMessage({
          type: "response",
          id,
          result: usesPreviewTransport(r.action)
            ? encodePreviewMessage(result)
            : result,
        });
      } catch (e) {
        await currentPanel.webview.postMessage({
          type: "response",
          id,
          error: message(e),
        });
      }
    });
    currentPanel.onDidDispose(() => {
      changes.dispose();
      receiver.dispose();
      panel = undefined;
    });
    await refreshEditor();
  };
  const handle = (fn: () => Promise<unknown>) => async () => {
    try {
      await fn();
    } catch (e) {
      void vscode.window.showErrorMessage(message(e));
    }
  };
  const sidebar: vscode.TreeDataProvider<vscode.TreeItem> = {
    getTreeItem: (item) => item,
    getChildren: () =>
      [
        ["현재 파일 설명 열기", "pureobom.explain", "book"],
        ["작업 공간 연결 지도", "pureobom.map", "type-hierarchy"],
        ["예제로 시작하기", "pureobom.example", "beaker"],
        ["React 화면 문구 바꿔보기", "pureobom.interfaceExample", "layout"],
        ["로컬 AI로 설명·수정", "pureobom.localAI", "sparkle"],
      ].map(([label, command, icon]) => {
        const item = new vscode.TreeItem(label);
        item.command = { command, title: label };
        item.iconPath = new vscode.ThemeIcon(icon);
        return item;
      }),
  };
  context.subscriptions.push(
    controller,
    vscode.window.registerTreeDataProvider("pureobom.start", sidebar),
    vscode.commands.registerCommand("pureobom.explain", handle(openPanel)),
    vscode.commands.registerCommand(
      "pureobom.localAI",
      handle(async () => {
        await openPanel();
        controller.openAssistant();
      }),
    ),
    vscode.commands.registerCommand(
      "pureobom.map",
      handle(async () => {
        await openPanel();
        await controller.scan();
      }),
    ),
    vscode.commands.registerCommand(
      "pureobom.example",
      handle(async () => {
        const doc = await vscode.workspace.openTextDocument({
          language: "typescript",
          content: example,
        });
        await vscode.window.showTextDocument(doc, {
          viewColumn: vscode.ViewColumn.One,
          preview: false,
        });
        await openPanel();
      }),
    ),
    vscode.commands.registerCommand(
      "pureobom.interfaceExample",
      handle(async () => {
        const doc = await vscode.workspace.openTextDocument({
          language: "typescriptreact",
          content: interfaceDemo[0].content,
        });
        await vscode.window.showTextDocument(doc, {
          viewColumn: vscode.ViewColumn.One,
          preview: false,
        });
        await openPanel();
      }),
    ),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (
        panel &&
        editor &&
        !Controller.accepts(editor.document) &&
        !["pureobom-preview", "pureobom-local-preview"].includes(
          editor.document.uri.scheme,
        )
      ) {
        controller.clearDocument();
        return;
      }
      if (panel && editor && Controller.accepts(editor.document)) {
        if (
          controller.isActive(editor.document) &&
          editor.document.version === controller.state.version
        )
          return;
        void controller.setDocument(editor.document);
      }
    }),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (panel) controller.documentChanged(e.document);
    }),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (panel) controller.documentChanged(doc);
    }),
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      if (panel) void controller.refresh();
    }),
    { dispose: () => panel?.dispose() },
  );
  // Public API used by integration tests; all operations retain document/version validation.
  return { controller, openPanel, runtimeMode: context.extensionMode };
}
function html(webview: vscode.Webview, root: vscode.Uri) {
  const script = webview.asWebviewUri(
    vscode.Uri.joinPath(root, "media/view.js"),
  );
  const css = webview.asWebviewUri(vscode.Uri.joinPath(root, "media/view.css"));
  const nonce = randomBytes(24).toString("base64");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};"><link href="${css}" rel="stylesheet"><title>풀어봄</title></head><body><div id="root"></div><script nonce="${nonce}" src="${script}"></script></body></html>`;
}
const example = `// 무료 배송 기준과 배송비를 문장으로 읽고 바꿔 보세요.\nconst freeShippingThreshold = 50000;\nconst shippingFee = 3000;\n\nexport function calculateShipping(subtotal: number) {\n  if (subtotal < 0) throw new Error("주문 금액은 0 이상이어야 합니다.");\n  if (subtotal >= freeShippingThreshold) return 0;\n  return shippingFee;\n}\n`;
