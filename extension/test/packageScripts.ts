import * as assert from "node:assert/strict";
import * as vscode from "vscode";
import type { Controller } from "../src/controller";

export async function packageScriptChecks(
  c: Controller,
  ready: () => Promise<void>,
  reports: string[],
) {
  for (const doc of vscode.workspace.textDocuments.filter((d) => d.isDirty)) {
    await vscode.window.showTextDocument(doc);
    await vscode.commands.executeCommand(
      "workbench.action.revertAndCloseActiveEditor",
    );
  }
  const root = vscode.workspace.workspaceFolders![0].uri;
  const manifest = vscode.Uri.joinPath(root, "package.json"),
    originalManifest = await vscode.workspace.fs.readFile(manifest);
  const doc = await vscode.workspace.openTextDocument(
    vscode.Uri.joinPath(root, "package-value.cjs"),
  );
  await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
  await c.setDocument(doc);
  await ready();
  const original = doc.getText();
  const hooks = vscode.Uri.joinPath(root, "test-results", "package-hooks.txt");
  async function hookText() {
    try {
      return Buffer.from(await vscode.workspace.fs.readFile(hooks)).toString();
    } catch {
      return "";
    }
  }
  async function until(check: () => boolean, description: string) {
    const start = Date.now();
    while (!check()) {
      if (Date.now() - start > 30000)
        throw Error(description + ": " + JSON.stringify(c.checks.result));
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  const npm = vscode.extensions.getExtension("vscode.npm");
  assert.ok(npm, "built-in npm task provider is present");
  await npm.activate();
  const tasks = await c.checks.list(c.state.contextId);
  const task = tasks.find((t) => t.packageScript?.name === "check");
  assert.ok(task, "ungrouped check script is discovered");
  assert.deepEqual(task.packageScript, {
    file: "package.json",
    name: "check",
    command: "node package-check.cjs",
    before: "node package-hook.cjs before",
    after: "node package-hook.cjs after",
  });
  assert.ok(
    tasks
      .filter((t) => t.packageScript)
      .every((t) =>
        ["check", "build", "test", "typecheck", "lint"].includes(
          t.packageScript!.name,
        ),
      ),
  );
  assert.equal(
    await hookText(),
    "",
    "listing must not execute scripts or hooks",
  );
  await assert.rejects(
    c.checks.start(c.state.contextId, task.id, false),
    /Review/,
  );
  const changed = JSON.parse(Buffer.from(originalManifest).toString());
  changed.scripts.precheck = "node package-hook.cjs changed";
  try {
    await vscode.workspace.fs.writeFile(
      manifest,
      Buffer.from(JSON.stringify(changed)),
    );
    await assert.rejects(
      c.checks.start(c.state.contextId, task.id, true),
      /Package script changed|Task configuration changed|Refresh/,
    );
    assert.equal(
      await hookText(),
      "",
      "stale manifest is rejected before execution",
    );
  } finally {
    await vscode.workspace.fs.writeFile(manifest, originalManifest);
  }
  reports.push(
    "Package scripts: built-in npm task discovery includes ungrouped check, displays actual script and pre/post declarations, excludes dev/watch/install/publish, never executes while listing and rejects a changed manifest before launch",
  );

  async function run(expected: "passed" | "failed") {
    const choices = await c.checks.list(c.state.contextId),
      choice = choices.find((t) => t.packageScript?.name === "check");
    assert.ok(choice);
    await c.checks.start(c.state.contextId, choice.id, true);
    await until(
      () => c.checks.result?.status === expected,
      "package check " + expected,
    );
    assert.equal(c.checks.result!.exitCode, expected === "passed" ? 0 : 1);
  }
  await run("passed");
  const rule = c.state.analysis!.rules.find((r) => r.name === "amount");
  assert.ok(rule);
  const patch = await c.prepare(c.state.contextId, {
    ruleId: rule.id,
    value: "41",
  });
  await c.apply(patch.id, c.state.contextId);
  await ready();
  await doc.save();
  await ready();
  await run("failed");
  await vscode.window.showTextDocument(doc, {
    viewColumn: vscode.ViewColumn.One,
    preserveFocus: false,
  });
  await vscode.commands.executeCommand("undo");
  await ready();
  await doc.save();
  await ready();
  assert.equal(doc.getText(), original);
  await run("passed");
  assert.deepEqual((await hookText()).trim().split(/\r?\n/), [
    "before",
    "after",
    "before",
    "before",
    "after",
  ]);
  assert.deepEqual(
    await vscode.workspace.fs.readFile(manifest),
    originalManifest,
  );
  assert.equal(
    Buffer.from(await vscode.workspace.fs.readFile(doc.uri)).toString(),
    original,
  );
  reports.push(
    "Package scripts: actual npm command passes, model-free source edit makes the original assertion fail, native undo restores pass and exact source; declared npm hooks run according to npm success/failure semantics",
  );
}
