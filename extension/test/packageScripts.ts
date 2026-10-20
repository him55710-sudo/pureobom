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
  async function writeManifest(bytes: Uint8Array) {
    // The fixture changes this file before launching a check. Wait for the same
    // workspace notification stream used by the product so a delayed event is
    // not attributed to the next run. Never clear or bypass the stale guard.
    const watcher = vscode.workspace.createFileSystemWatcher("**/*");
    let timer: ReturnType<typeof setTimeout> | undefined;
    let subscription: vscode.Disposable | undefined;
    const observed = new Promise<void>((resolve, reject) => {
      timer = setTimeout(
        () => reject(Error("Manifest change was not observed")),
        10000,
      );
      subscription = watcher.onDidChange((uri) => {
        if (uri.toString() === manifest.toString()) resolve();
      });
    });
    try {
      await Promise.all([
        vscode.workspace.fs.writeFile(manifest, bytes),
        observed,
      ]);
    } finally {
      clearTimeout(timer);
      subscription?.dispose();
      watcher.dispose();
    }
  }
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
    await writeManifest(Buffer.from(JSON.stringify(changed)));
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
    await writeManifest(originalManifest);
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
    assert.equal(
      c.checks.result!.stale,
      false,
      "Package check must still describe this saved fixture: " +
        JSON.stringify(c.checks.result),
    );
  }
  await run("passed");
  const baselineId = c.checks.result!.id;
  await assert.rejects(
    c.checks.pinBaseline(c.state.contextId, "unrelated-run"),
    /completed check/,
  );
  await c.checks.pinBaseline(c.state.contextId, baselineId);
  assert.equal(c.checks.comparison.outcome, "awaiting-run");
  const baseline = c.checks.comparison.baseline!;
  baseline.sourceSha256 = "tampered view";
  assert.notEqual(c.checks.comparison.baseline!.sourceSha256, "tampered view");
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
  await assert.rejects(
    c.checks.pinBaseline(c.state.contextId, baselineId),
    /completed check|Run again/,
  );
  assert.equal(
    c.checks.comparison.baseline!.stale,
    false,
    "history remains a snapshot",
  );
  assert.equal(
    c.checks.evidence(doc.uri, c.checks.comparison.baseline!.sourceSha256),
    undefined,
    "history cannot verify edited source",
  );
  await run("failed");
  assert.equal(c.checks.comparison.outcome, "passed-to-failed");
  assert.equal(c.checks.comparison.sourceChanged, true);
  assert.equal(
    c.state.checkComparison!.outcome,
    "passed-to-failed",
    "comparison reaches webview state",
  );
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
  assert.equal(c.checks.comparison.outcome, "both-passed");
  assert.equal(c.checks.comparison.sourceChanged, false);
  assert.equal(c.checks.comparison.baseline!.id, baselineId);
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
  const newManifest = JSON.parse(Buffer.from(originalManifest).toString());
  newManifest.description = "Changed configuration for comparison verification";
  try {
    await writeManifest(Buffer.from(JSON.stringify(newManifest)));
    await run("passed");
    assert.equal(
      c.checks.comparison.outcome,
      "different-command",
      "manifest changes invalidate comparisons even when the check still passes",
    );
    await c.checks.pinBaseline(c.state.contextId, c.checks.result!.id);
    assert.equal(c.checks.comparison.outcome, "awaiting-run");
  } finally {
    await writeManifest(originalManifest);
    c.checks.clearBaseline();
  }
  assert.equal(c.checks.comparison.outcome, "no-baseline");
  reports.push(
    "Project check comparison: actual npm pass is pinned, wrong-run and stale pin requests are rejected, source edit produces pass-to-fail, native undo restores both-passed with identical source bytes; changed manifest prevents comparison; historical snapshots cannot verify current code, can be replaced and cleared",
  );
  reports.push(
    "Package scripts: actual npm command passes, model-free source edit makes the original assertion fail, native undo restores pass and exact source; declared npm hooks run according to npm success/failure semantics",
  );
}
