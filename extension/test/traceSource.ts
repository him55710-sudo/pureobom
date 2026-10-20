import * as assert from "node:assert/strict";
import * as vscode from "vscode";
import type { Controller } from "../src/controller";

export async function traceSourceChecks(
  c: Controller,
  ready: () => Promise<void>,
  reports: string[],
) {
  const original = vscode.window.activeTextEditor;
  const root = vscode.Uri.joinPath(
    vscode.workspace.workspaceFolders![0].uri,
    "trace-navigation",
  );
  const mainUri = vscode.Uri.joinPath(root, "main.ts");
  const leftUri = vscode.Uri.joinPath(root, "a/helper.ts");
  const rightUri = vscode.Uri.joinPath(root, "b/helper.ts");
  const mainText =
    "import { left } from './a/helper';\nimport { right } from './b/helper';\nexport function calculate(n: number) {\n  return left(n) + right(n);\n}\n";
  const leftText =
    "export function left(n: number) {\n  if (n < 0) return 0;\n  while(n > 1) { n--; }\n  return [n].map(x => {\n    return x * 3;\n  })[0];\n}\n";
  const rightText =
    "// A different file with the same basename.\nexport function right(n: number) {\n  return n * 2;\n}\n";
  await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(root, "a"));
  await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(root, "b"));
  for (const [uri, content] of [
    [mainUri, mainText],
    [leftUri, leftText],
    [rightUri, rightText],
  ] as const)
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
  const main = await vscode.workspace.openTextDocument(mainUri);
  const reset = async () => {
    await vscode.window.showTextDocument(main, vscode.ViewColumn.One);
    await c.setDocument(main);
    await ready();
  };
  try {
    await reset();
    await c.scan();
    await ready();
    const first = await c.simulate(c.state.contextId, "calculate", "[2]");
    assert.equal(first.ok, true, first.error);
    assert.equal(first.result, 7);
    const index = first.trace.findIndex((step) =>
      step.path?.endsWith("/a/helper.ts"),
    );
    assert.ok(index >= 0);
    const context = c.state.contextId;
    for (const invalid of [-1, 0.5, NaN, "0", 9999])
      await assert.rejects(c.traceSource(context, first.traceId, invalid));
    await assert.rejects(c.traceSource(context, "forged", index));
    await assert.rejects(c.traceSource("stale", first.traceId, index));
    const newer = await c.simulate(context, "calculate", "[2]");
    await assert.rejects(c.traceSource(context, first.traceId, index));
    reports.push(
      "Trace source handles: unknown handles, stale contexts, superseded results and invalid indexes are rejected; clients cannot supply a navigation path",
    );

    // This dependency has not been opened. A disk edit need not emit an editor
    // change event, so the controller must compare with the calculation text.
    assert.ok(
      !vscode.workspace.textDocuments.some(
        (doc) => !doc.isClosed && doc.uri.toString() === leftUri.toString(),
      ),
    );
    await vscode.workspace.fs.writeFile(
      leftUri,
      Buffer.from("// shifted after calculation\n" + leftText),
    );
    await assert.rejects(
      c.traceSource(context, newer.traceId, index),
      /source changed/i,
    );
    assert.equal(
      vscode.window.activeTextEditor?.document.uri.toString(),
      mainUri.toString(),
    );
    reports.push(
      "Trace source freshness: an unopened imported file changed on disk is rejected before showing a stale line, even without an editor change notification",
    );
    const changed = await vscode.workspace.openTextDocument(leftUri);
    const restore = new vscode.WorkspaceEdit();
    restore.replace(
      leftUri,
      new vscode.Range(
        changed.positionAt(0),
        changed.positionAt(changed.getText().length),
      ),
      leftText,
    );
    assert.equal(await vscode.workspace.applyEdit(restore), true);
    await changed.save();
    await reset();

    const expected = [
      [leftUri, 2],
      [leftUri, 3],
      [leftUri, 5],
      [leftUri, 5],
      [leftUri, 4],
      [rightUri, 3],
      [rightUri, 3],
      [mainUri, 4],
      [mainUri, 4],
    ] as const;
    for (let i = 0; i < expected.length; i++) {
      await reset();
      const result = await c.simulate(c.state.contextId, "calculate", "[2]");
      assert.equal(result.trace.length, expected.length);
      // Modifying the API response must not redirect the retained source entry.
      result.trace[i].path = "../../unrelated.ts";
      result.trace[i].line = 9999;
      await c.traceSource(c.state.contextId, result.traceId, i);
      const editor = vscode.window.visibleTextEditors.find(
        (editor) =>
          editor.document.uri.toString() === expected[i][0].toString(),
      );
      assert.ok(editor, "the recorded source document is shown");
      assert.equal(editor.selection.start.line, expected[i][1] - 1);
      assert.equal(editor.selection.start.character, 0);
    }
    assert.equal(main.getText(), mainText);
    assert.equal(
      (await vscode.workspace.openTextDocument(leftUri)).getText(),
      leftText,
    );
    assert.equal(
      (await vscode.workspace.openTextDocument(rightUri)).getText(),
      rightText,
    );
    reports.push(
      "Trace source navigation: actual worker/controller opens exact imported condition, loop, callback and return lines across files with duplicate basenames; returned-data mutation cannot redirect selection; source text stays unchanged",
    );
  } finally {
    if (original) {
      await vscode.window.showTextDocument(
        original.document,
        vscode.ViewColumn.One,
      );
      await c.setDocument(original.document);
      await ready();
    }
  }
}
