import * as assert from "node:assert/strict";
import * as vscode from "vscode";
import { createHash } from "node:crypto";
import { relative, isAbsolute } from "node:path";
import type { Controller } from "../src/controller";
import { localAssistantChecks } from "./localAssistant";
import { projectChecks } from "./projectChecks";
import { benchmarkChecks } from "./benchmarks";
import { pythonSourceChecks } from "./pythonSource";
import { goSourceChecks } from "./goSource";
import { javaSourceChecks } from "./javaSource";
import { csharpSourceChecks } from "./csharpSource";
import { rustSourceChecks } from "./rustSource";
import { webSourceChecks } from "./webSource";
import { sqlSourceChecks } from "./sqlSource";
import { functionFormatChecks } from "./formatFunction";
import { previewValueChecks } from "./previewValues";
const reports: string[] = [];
async function until(
  check: () => boolean,
  description: string,
  timeout = 25000,
) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw Error(`Timed out: ${description}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
export async function run() {
  const extension = vscode.extensions.getExtension<{
    controller: Controller;
    openPanel: () => Promise<void>;
    runtimeMode: vscode.ExtensionMode;
  }>("pureobom-local.pureobom");
  assert.ok(extension, "Pureobom is available in this VS Code instance");
  let installation: Record<string, unknown> | undefined;
  if (process.env.PUREOBOM_EXPECTED_INSTALL) {
    const expected = JSON.parse(process.env.PUREOBOM_EXPECTED_INSTALL) as {
      version: string;
      vsixSha256: string;
      extensionsPath: string;
      files: Record<string, string>;
    };
    const location = relative(expected.extensionsPath, extension.extensionPath);
    assert.ok(
      location && !location.startsWith("..") && !isAbsolute(location),
      "loads the isolated installed VSIX, not the source checkout",
    );
    assert.equal(extension.packageJSON.version, expected.version);
    for (const [path, digest] of Object.entries(expected.files)) {
      const bytes = await vscode.workspace.fs.readFile(
        vscode.Uri.joinPath(extension.extensionUri, path),
      );
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        digest,
        `Installed artifact matches VSIX: ${path}`,
      );
    }
    installation = {
      kind: "installed-vsix",
      version: expected.version,
      vsixSha256: expected.vsixSha256,
      verifiedFiles: expected.files,
      extensionMode: "production",
    };
  }
  const api = await extension.activate(),
    c = api.controller;
  if (installation)
    assert.equal(
      api.runtimeMode,
      vscode.ExtensionMode.Production,
      "installed product runs in production extension mode",
    );
  const root = vscode.workspace.workspaceFolders![0].uri;
  const uri = vscode.Uri.joinPath(root, "shipping.ts");
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc, {
    viewColumn: vscode.ViewColumn.One,
  });
  await api.openPanel();
  const ready = async () => {
    try {
      await until(() => !c.state.busy && !!c.state.analysis, "analysis ready");
    } catch (error) {
      throw Error(
        `${String(error)}: ${JSON.stringify({ path: c.state.path, busy: c.state.busy, error: c.state.error })}`,
      );
    }
  };
  await ready();
  if (process.env.PUREOBOM_ONLY_BENCHMARK === "1") {
    await benchmarkChecks(c, ready, reports);
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(process.env.PUREOBOM_INTEGRATION_REPORT!),
      Buffer.from(
        JSON.stringify(
          {
            vscode: vscode.version,
            checks: reports,
            passed: reports.length,
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        ),
      ),
    );
    console.log(
      "PUREOBOM BENCHMARK INTEGRATION PASSED",
      JSON.stringify(reports),
    );
    c.dispose();
    return;
  }
  const firstTerm = c.state.analysis!.terms!.find(
    (term) => term.name === "freeShippingThreshold",
  )!;
  if (firstTerm.custom?.ko)
    await c.setTerm(c.state.contextId, firstTerm.id, "ko", "");
  assert.equal(c.state.analysis!.functions[0].name, "calculateShipping");
  assert.ok(
    c.state.analysis!.rules.find((r) => r.name === "freeShippingThreshold"),
  );
  reports.push("activation, real webview panel and initial explanation");

  const editor = await vscode.window.showTextDocument(
    doc,
    vscode.ViewColumn.One,
  );
  const start = doc.getText().indexOf("50000");
  await editor.edit((b) =>
    b.replace(
      new vscode.Range(doc.positionAt(start), doc.positionAt(start + 5)),
      "60000",
    ),
  );
  await until(
    () =>
      !c.state.busy &&
      c.state.analysis?.rules.some(
        (r) => r.name === "freeShippingThreshold" && r.value === 60000,
      ) === true,
    "unsaved changes reflected",
  );
  assert.equal(doc.isDirty, true);
  reports.push("unsaved document changes trigger fresh Korean analysis");

  await c.scan();
  await ready();
  const scanned = c.state.project!.files.map((file) => file.path);
  assert.ok(scanned.some((path) => path.endsWith("helper.ts")));
  assert.equal(
    scanned.some((path) => path.endsWith("hidden.ts")),
    false,
  );
  reports.push(
    "Project scanning includes ordinary files beneath a hidden workspace root while excluding hidden files and folders inside it",
  );
  const rule = () =>
    c.state.analysis!.rules.find((r) => r.name === "freeShippingThreshold")!;
  const prepared = await c.prepare(c.state.contextId, {
    ruleId: rule().id,
    value: "70000",
  });
  const preview = await c.preview(prepared.id, c.state.contextId);
  const before = await vscode.workspace.openTextDocument(
    vscode.Uri.parse(preview.before),
  );
  const after = await vscode.workspace.openTextDocument(
    vscode.Uri.parse(preview.after),
  );
  assert.ok(before.getText().includes("60000"));
  assert.ok(after.getText().includes("70000"));
  assert.equal(
    doc.getText().includes("70000"),
    false,
    "preview must not mutate source",
  );
  reports.push(
    "native VS Code diff shows correct before/after without mutation",
  );

  const comparison = await c.compare(
    c.state.contextId,
    "calculateShipping",
    [59999, 60000, 70000].map((n) => ({ label: String(n), args: [n] })),
    prepared.id,
  );
  assert.deepEqual(
    comparison.rows.map((r) => r.status),
    ["same", "changed", "same"],
    JSON.stringify(comparison.rows),
  );
  assert.equal(comparison.rows[1].before.result, 0);
  assert.equal(comparison.rows[1].after?.result, 3000);
  assert.equal(doc.getText().includes("70000"), false);
  reports.push(
    "scenario matrix compares actual pending patch without changing the editor",
  );
  await c.apply(prepared.id, c.state.contextId);
  await ready();
  assert.ok(doc.getText().includes("70000"));
  assert.equal(doc.isDirty, true);
  const disk = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString();
  assert.ok(disk.includes("50000"), "apply must not save automatically");
  await vscode.window.showTextDocument(doc, {
    viewColumn: vscode.ViewColumn.One,
    preserveFocus: false,
  });
  await vscode.commands.executeCommand("undo");
  await until(() => doc.getText().includes("60000"), "native undo");
  await ready();
  reports.push(
    "apply changes editor only; native undo restores the previous value",
  );

  const oldContext = c.state.contextId;
  const stale = await c.prepare(oldContext, {
    ruleId: rule().id,
    value: "80000",
  });
  const sourceEditor = await vscode.window.showTextDocument(
    doc,
    vscode.ViewColumn.One,
  );
  await sourceEditor.edit((b) =>
    b.insert(new vscode.Position(0, 0), "// changed after preview\n"),
  );
  await assert.rejects(() => c.apply(stale.id, oldContext));
  await assert.rejects(() =>
    c.compare(
      oldContext,
      "calculateShipping",
      [{ label: "1", args: [60000] }],
      stale.id,
    ),
  );
  assert.equal(doc.getText().includes("80000"), false);
  await ready();
  reports.push("stale preview rejected after an intervening editor change");

  await c.scan();
  await ready();
  const imports = c.state.analysis!.imports;
  assert.ok(
    imports.some((i) => i.target?.endsWith("helper.ts")),
    "relative imports linked",
  );
  await assert.rejects(() => c.select("../../outside-workspace.ts"));
  const simulation = await c.simulate(
    c.state.contextId,
    "calculateShipping",
    "[59999]",
  );
  assert.equal(simulation.ok, true);
  assert.equal(simulation.result, 3000);
  reports.push(
    "workspace graph resolves relative imports, restricts navigation and simulates inputs",
  );

  const natural = await c.prepare(c.state.contextId, {
    request: "무료 배송 기준을 90000으로 변경",
  });
  const naturalContext = c.state.contextId;
  const helper = await vscode.workspace.openTextDocument(
    vscode.Uri.joinPath(root, "helper.ts"),
  );
  await vscode.window.showTextDocument(helper, vscode.ViewColumn.One);
  await until(
    () =>
      !c.state.busy && c.state.analysis?.path.endsWith("helper.ts") === true,
    "switch editor",
  );
  await assert.rejects(() => c.apply(natural.id, naturalContext));
  assert.equal(doc.getText().includes("90000"), false);
  reports.push(
    "natural-language change prepared; switching files invalidates it",
  );

  await c.setDocument(doc);
  await ready();
  await c.source(c.state.contextId, 3);
  assert.equal(vscode.window.activeTextEditor?.selection.start.line, 2);
  reports.push("explanation source link selects the correct editor line");
  const originalText = doc.getText();
  const term = c.state.analysis!.terms!.find(
    (term) => term.name === "freeShippingThreshold",
  )!;
  const beforeTermContext = c.state.contextId;
  const beforeTermPatch = await c.prepare(beforeTermContext, {
    ruleId: rule().id,
    value: "85000",
  });
  await c.setTerm(beforeTermContext, term.id, "ko", "우리 가게 무료 배송선");
  assert.equal(rule().label.ko, "우리 가게 무료 배송선");
  assert.equal(
    doc.getText(),
    originalText,
    "terminology must not rename source identifiers",
  );
  await assert.rejects(() => c.apply(beforeTermPatch.id, beforeTermContext));
  await assert.rejects(() =>
    c.setTerm(beforeTermContext, term.id, "ko", "old context"),
  );
  const custom = await c.prepare(c.state.contextId, {
    request: "우리 가게 무료 배송선을 75000으로 변경",
  });
  assert.equal(custom.newText, "75000");
  assert.ok(custom.description.ko.includes("우리 가게 무료 배송선"));
  reports.push(
    "custom project term changes explanations and sentence editing; source stays intact and old patches expire",
  );
  await c.setDocument(helper);
  assert.ok(
    !JSON.stringify(c.state.analysis).includes("우리 가게 무료 배송선"),
  );
  await c.setDocument(doc);
  assert.equal(rule().label.ko, "우리 가게 무료 배송선");
  await c.setTerm(c.state.contextId, term.id, "ko", "");
  assert.equal(rule().label.ko, "무료 배송 기준");
  assert.equal(doc.getText(), originalText);
  reports.push(
    "terminology survives file switches, stays scoped to its document and resets to the default",
  );
  await vscode.commands.executeCommand("pureobom.interfaceExample");
  await until(
    () => !c.state.busy && !!c.state.analysis?.interface,
    "React example analysis",
  );
  const screen = vscode.window.activeTextEditor!.document;
  assert.equal(screen.languageId, "typescriptreact");
  const screenBefore = screen.getText();
  const phrase = c.state.analysis!.rules.find(
    (r) => r.value === "무료로 시작하기",
  )!;
  assert.ok(phrase);
  assert.equal(
    c.state.analysis!.functions.find((f) => f.name === "SignupCard")
      ?.simulatable,
    false,
  );
  await c.source(c.state.contextId, phrase.line);
  assert.equal(
    vscode.window.activeTextEditor?.selection.start.line,
    phrase.line - 1,
  );
  const textChange = await c.prepare(c.state.contextId, {
    ruleId: phrase.id,
    value: "14일 무료 체험",
  });
  const jsxPreview = await c.preview(textChange.id, c.state.contextId);
  const jsxAfter = await vscode.workspace.openTextDocument(
    vscode.Uri.parse(jsxPreview.after),
  );
  assert.ok(jsxAfter.getText().includes('{"14일 무료 체험"}</button>'));
  assert.equal(
    jsxAfter.languageId,
    "typescriptreact",
    "TSX diff must preserve source language instead of becoming TypeScript",
  );
  assert.equal(screen.getText(), screenBefore);
  await c.apply(textChange.id, c.state.contextId);
  assert.ok(screen.getText().includes('{"14일 무료 체험"}</button>'));
  assert.equal(screen.isDirty, true);
  await until(
    () =>
      !c.state.busy &&
      c.state.analysis?.rules.some((r) => r.value === "14일 무료 체험") ===
        true,
    "JSX edit reanalysis",
  );
  await vscode.window.showTextDocument(screen, vscode.ViewColumn.One);
  await vscode.commands.executeCommand("undo");
  await until(() => screen.getText() === screenBefore, "native JSX undo");
  reports.push(
    "React example command, TSX structure, source line, inert text diff, editor apply, reanalysis and native undo",
  );
  const cleanupSource =
    "function save() {\n  try { return persist(); }\n  catch (error) { return recover(error); }\n  finally { cleanup(); }\n}\n";
  const cleanupDoc = await vscode.workspace.openTextDocument({
    language: "typescript",
    content: cleanupSource,
  });
  await vscode.window.showTextDocument(cleanupDoc, vscode.ViewColumn.One);
  await c.setDocument(cleanupDoc);
  await until(
    () => !c.state.busy && c.state.analysis?.functions[0]?.name === "save",
    "cleanup flow analysis",
  );
  const guard = c.state.analysis!.functions[0].steps[0];
  assert.equal(guard.children.length, 1);
  assert.equal(guard.otherwise?.length, 1);
  assert.equal(guard.finalizer?.kind, "finally");
  assert.ok(guard.children[0].text.en.includes("enclosing finally"));
  assert.ok(guard.otherwise![0].text.en.includes("enclosing finally"));
  await c.source(c.state.contextId, guard.finalizer!.children[0].line);
  assert.equal(vscode.window.activeTextEditor?.selection.start.line, 3);
  assert.equal(cleanupDoc.getText(), cleanupSource);
  reports.push(
    "worker preserves separate cleanup branch, pending returns and finalizer source navigation without code mutation",
  );
  const diagnosticDoc = await vscode.workspace.openTextDocument({
    language: "typescript",
    content: "export const fee: number = 3000;\n",
  });
  const diagnosticEditor = await vscode.window.showTextDocument(
    diagnosticDoc,
    vscode.ViewColumn.One,
  );
  await c.setDocument(diagnosticDoc);
  const collection = vscode.languages.createDiagnosticCollection(
    "pureobom-integration",
  );
  try {
    const warning = new vscode.Diagnostic(
      new vscode.Range(0, 13, 0, 16),
      "Review this value",
      vscode.DiagnosticSeverity.Warning,
    );
    warning.source = "pureobom-integration";
    warning.code = "review-fee";
    const beforeDiagnosticContext = c.state.contextId;
    collection.set(diagnosticDoc.uri, [warning]);
    await until(
      () =>
        c.state.diagnostics?.items.some(
          (d) => d.source === "pureobom-integration",
        ) === true,
      "diagnostic provider event",
    );
    assert.equal(
      c.state.contextId,
      beforeDiagnosticContext,
      "diagnostic updates must not discard a code proposal",
    );
    const firstSnapshot = c.state.diagnostics!;
    const firstProblem = firstSnapshot.items.find(
      (d) => d.source === "pureobom-integration",
    )!;
    await c.diagnosticSource(
      c.state.contextId,
      firstSnapshot.revision,
      firstProblem.id,
    );
    assert.equal(
      vscode.window.activeTextEditor?.document.uri.toString(),
      diagnosticDoc.uri.toString(),
    );
    assert.equal(
      diagnosticDoc.getText(vscode.window.activeTextEditor!.selection),
      "fee",
    );
    reports.push(
      "editor provider reports preserve context, source, severity and exact source selection",
    );

    await diagnosticEditor.edit((b) =>
      b.replace(new vscode.Range(0, 26, 0, 30), "4000"),
    );
    await ready();
    assert.equal(c.state.diagnostics?.status, "edited");
    await assert.rejects(() =>
      c.diagnosticSource(
        c.state.contextId,
        firstSnapshot.revision,
        firstProblem.id,
      ),
    );
    warning.message = "Review the new value";
    collection.set(diagnosticDoc.uri, [warning]);
    await until(
      () =>
        c.state.diagnostics?.items.some(
          (d) => d.message === "Review the new value",
        ) === true,
      "updated diagnostic message",
    );
    assert.equal(c.state.diagnostics?.status, "reported");
    assert.equal(c.state.diagnostics?.version, diagnosticDoc.version);
    await assert.rejects(() =>
      c.diagnosticSource(
        c.state.contextId,
        firstSnapshot.revision,
        firstProblem.id,
      ),
    );
    const latest = c.state.diagnostics!;
    await c.setDocument(cleanupDoc);
    assert.equal(
      c.state.diagnostics?.items.some(
        (d) => d.source === "pureobom-integration",
      ),
      false,
    );
    await assert.rejects(() =>
      c.diagnosticSource(
        c.state.contextId,
        latest.revision,
        latest.items[0].id,
      ),
    );
    await c.setDocument(diagnosticDoc);
    collection.delete(diagnosticDoc.uri);
    await until(
      () =>
        c.state.diagnostics?.items.every(
          (d) => d.source !== "pureobom-integration",
        ) === true,
      "removed diagnostic clears",
    );
    reports.push(
      "edited reports, replaced report IDs and file switches reject stale navigation; removed reports clear",
    );
  } finally {
    collection.dispose();
  }

  const typescript = vscode.extensions.getExtension(
    "vscode.typescript-language-features",
  );
  // Earlier diff fixtures create virtual TS projects. Close only our preview
  // tabs before waiting for a real language-server report on the source file.
  const previewTabs = vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter(
      (tab) =>
        tab.input instanceof vscode.TabInputTextDiff &&
        tab.input.original.scheme === "pureobom-preview",
    );
  await vscode.window.tabGroups.close(previewTabs, true);
  assert.ok(typescript, "built-in TypeScript extension is available");
  await typescript.activate();
  const typedUri = vscode.Uri.joinPath(root, "typed-fee.ts");
  await vscode.workspace.fs.writeFile(
    typedUri,
    Buffer.from("export const shippingFee: 3000 | 5000 = 3000;\n"),
  );
  const typedDoc = await vscode.workspace.openTextDocument(typedUri);
  await vscode.window.showTextDocument(typedDoc, vscode.ViewColumn.One);
  await c.setDocument(typedDoc);
  const typedRule = c.state.analysis!.rules.find(
    (r) => r.name === "shippingFee",
  )!;
  assert.ok(typedRule);
  const typedPatch = await c.prepare(c.state.contextId, {
    ruleId: typedRule.id,
    value: "4000",
  });
  await c.apply(typedPatch.id, c.state.contextId);
  try {
    await until(
      () =>
        c.state.diagnostics?.items.some(
          (d) => d.source === "ts" && d.code === "2322",
        ) === true,
      "real TypeScript assignment error after applying rule edit",
      60000,
    );
  } catch (error) {
    throw Error(
      `${String(error)}: ${JSON.stringify({ path: c.state.path, current: typedDoc.getText(), diagnostics: c.state.diagnostics, raw: vscode.languages.getDiagnostics(typedUri) })}`,
    );
  }
  const typeSnapshot = c.state.diagnostics!;
  const typeError = typeSnapshot.items.find(
    (d) => d.source === "ts" && d.code === "2322",
  )!;
  assert.ok(typeError.explanation?.ko);
  assert.ok(typeError.message.includes("4000"));
  await ready();
  await c.diagnosticSource(
    c.state.contextId,
    typeSnapshot.revision,
    typeError.id,
  );
  assert.equal(
    typedDoc.getText(vscode.window.activeTextEditor!.selection),
    "shippingFee",
  );
  // Diagnostic navigation deliberately preserves panel focus. Undo is an
  // editor command, so focus the source before exercising its undo stack.
  await vscode.window.showTextDocument(typedDoc, {
    viewColumn: vscode.ViewColumn.One,
    preserveFocus: false,
  });
  await vscode.commands.executeCommand("undo");
  assert.equal(
    typedDoc.getText(),
    "export const shippingFee: 3000 | 5000 = 3000;\n",
  );
  await until(
    () =>
      c.state.diagnostics?.items.every(
        (d) => !(d.source === "ts" && d.code === "2322"),
      ) === true,
    "real TypeScript error clears after undo",
  );
  assert.ok(typedDoc.getText().includes("= 3000"));
  reports.push(
    "built-in TypeScript reports an actual 2322 error after a rule edit; source selection and undo clear it",
  );
  await pythonSourceChecks(c, ready, reports);
  await goSourceChecks(c, ready, reports);
  await javaSourceChecks(c, ready, reports);
  await csharpSourceChecks(c, ready, reports);
  await rustSourceChecks(c, ready, reports);
  await localAssistantChecks(c, ready, reports);
  const jsoncSource =
    '{ // 정책\n "url": "https://example.com/path", "fee": 3000,\n}';
  const jsoncDoc = await vscode.workspace.openTextDocument({
    language: "jsonc",
    content: jsoncSource,
  });
  await vscode.window.showTextDocument(jsoncDoc, vscode.ViewColumn.One);
  await c.setDocument(jsoncDoc);
  await ready();
  assert.equal(c.state.analysis!.kind, "json");
  assert.equal(
    c.state.analysis!.syntaxValid,
    true,
    "untitled JSONC preserves its language for the worker",
  );
  assert.ok(c.state.analysis!.steps[0].text.ko.includes("2개 항목"));
  assert.equal(c.state.analysis!.data!.fields.length, 2);
  const jsonFee = c.state.analysis!.rules.find((r) => r.name === '$["fee"]')!;
  assert.equal(jsonFee.value, "3000");
  assert.equal(jsonFee.syntax, "json");
  assert.ok(
    c.state.analysis!.steps.some(
      (step) => step.text.en === '$["fee"] stores number 3000',
    ),
  );
  assert.ok(
    c.state.analysis!.steps.some(
      (step) => step.text.ko === '$["fee"]에 숫자 3000 저장',
    ),
  );
  await c.source(c.state.contextId, jsonFee.line);
  assert.equal(vscode.window.activeTextEditor!.selection.active.line, 1);
  const jsonContext = c.state.contextId;
  const jsonPatch = await c.prepare(jsonContext, {
    ruleId: jsonFee.id,
    value: "9007199254740993",
  });
  assert.equal(jsonPatch.newText, "9007199254740993");
  const jsonPreview = await c.preview(jsonPatch.id, jsonContext);
  const jsonBefore = await vscode.workspace.openTextDocument(
    vscode.Uri.parse(jsonPreview.before),
  );
  const jsonAfter = await vscode.workspace.openTextDocument(
    vscode.Uri.parse(jsonPreview.after),
  );
  assert.equal(jsonBefore.languageId, "jsonc");
  assert.equal(jsonAfter.languageId, "jsonc");
  assert.equal(jsonBefore.getText(), jsoncSource);
  assert.equal(
    jsonAfter.getText(),
    jsoncSource.replace("3000", "9007199254740993"),
  );
  assert.equal(
    jsoncDoc.getText(),
    jsoncSource,
    "JSONC preview must not mutate source",
  );
  await c.apply(jsonPatch.id, jsonContext);
  await ready();
  assert.equal(jsoncDoc.getText(), jsonAfter.getText());
  assert.equal(
    c.state.analysis!.rules.find((r) => r.name === '$["fee"]')!.value,
    "9007199254740993",
  );
  await vscode.window.showTextDocument(jsoncDoc, vscode.ViewColumn.One);
  await vscode.commands.executeCommand("undo");
  await until(
    () =>
      !c.state.busy &&
      c.state.analysis?.rules.some(
        (r) => r.name === '$["fee"]' && r.value === "3000",
      ) === true,
    "JSONC literal undo refreshes source facts",
  );
  assert.equal(jsoncDoc.getText(), jsoncSource);
  await assert.rejects(
    c.apply(jsonPatch.id, jsonContext),
    "a used JSON patch cannot be reapplied",
  );
  const staleJson = await c.prepare(c.state.contextId, {
    request: 'change $["fee"] to 4000',
  });
  const staleContext = c.state.contextId;
  const feeStart = jsoncSource.indexOf("3000");
  const currentJsonEditor = await vscode.window.showTextDocument(
    jsoncDoc,
    vscode.ViewColumn.One,
  );
  await currentJsonEditor.edit((builder) =>
    builder.delete(
      new vscode.Range(
        jsoncDoc.positionAt(feeStart),
        jsoncDoc.positionAt(feeStart + 4),
      ),
    ),
  );
  await until(
    () => !c.state.busy && c.state.analysis?.syntaxValid === false,
    "invalid JSONC is reported after unsaved edits",
  );
  await assert.rejects(
    c.apply(staleJson.id, staleContext),
    "edited JSON document invalidates a pending literal patch",
  );
  await vscode.commands.executeCommand("undo");
  await until(
    () => !c.state.busy && c.state.analysis?.syntaxValid === true,
    "JSONC undo restores valid analysis",
  );
  assert.equal(jsoncDoc.getText(), jsoncSource);
  reports.push(
    "JSONC untitled document: comments, trailing comma and URL preserved; invalid unsaved edit reported and undo restores valid worker analysis",
  );
  reports.push(
    "JSONC source facts in Korean/English, source navigation, model-free numeric edit, native JSONC diff, exact unsafe-integer spelling, apply/undo and stale edit rejection",
  );
  await webSourceChecks(c, ready, reports);
  await sqlSourceChecks(c, ready, reports);
  await functionFormatChecks(c, ready, reports);
  await previewValueChecks(c, ready, reports);
  await projectChecks(c, ready, reports);
  await benchmarkChecks(c, ready, reports);
  const report = {
    installation,
    vscode: vscode.version,
    checks: reports,
    passed: reports.length,
    timestamp: new Date().toISOString(),
  };
  await vscode.workspace.fs.writeFile(
    process.env.PUREOBOM_INTEGRATION_REPORT
      ? vscode.Uri.file(process.env.PUREOBOM_INTEGRATION_REPORT)
      : vscode.Uri.joinPath(root, "..", "extension-integration.json"),
    Buffer.from(JSON.stringify(report, null, 2)),
  );
  console.log("PUREOBOM INTEGRATION PASSED", JSON.stringify(report));
  // Close dirty documents without touching the on-disk fixtures.
  await vscode.commands.executeCommand(
    "workbench.action.revertAndCloseActiveEditor",
  );
  c.dispose();
}
