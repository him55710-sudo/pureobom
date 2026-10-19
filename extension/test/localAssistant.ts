import * as assert from "node:assert/strict";
import * as vscode from "vscode";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Controller } from "../src/controller";

/** Actual VS Code editor integration; Ollama HTTP responses are controlled fixtures. */
export async function localAssistantChecks(
  c: Controller,
  ready: () => Promise<void>,
  reports: string[],
) {
  let mode:
      | "normal"
      | "explain-focus"
      | "explain-wrong"
      | "hold"
      | "invalid"
      | "format-with-braces"
      | "format-valid"
      | "go-valid"
      | "go-invalid"
      | "csharp-valid"
      | "csharp-invalid"
      | "rust-valid"
      | "rust-invalid"
      | "java-valid"
      | "java-invalid"
      | "sql-valid"
      | "sql-invalid" = "normal",
    chatSeen = false;
  let focusRequest: Record<string, any> | undefined;
  let focusProcessor: number | undefined;
  const model = {
    name: "fixture:local",
    size: 1900000000,
    digest: "a".repeat(64),
    details: { format: "gguf" },
  };
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString(),
      body = raw ? JSON.parse(raw) : {};
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/api/status") {
      res.end(JSON.stringify({ cloud: { disabled: true } }));
      return;
    }
    if (req.url === "/api/tags") {
      res.end(JSON.stringify({ models: [model] }));
      return;
    }
    if (req.url === "/api/show") {
      res.end(
        JSON.stringify({
          details: { format: "gguf" },
          model_info: { "general.architecture": "fixture" },
          capabilities: ["completion"],
        }),
      );
      return;
    }
    chatSeen = true;
    if (mode === "hold") return;
    const input = JSON.parse(body.messages[1].content);
    if (mode.startsWith("explain-")) {
      focusRequest = input;
      focusProcessor = body.options.num_gpu;
      assert.equal(body.truncate, false);
      assert.equal(body.shift, false);
      res.end(
        JSON.stringify({
          done: true,
          done_reason: "stop",
          message: {
            content: JSON.stringify({
              summary:
                "입력과 배율을 곱해 반환합니다. 입력을 검사하지 않습니다.",
              citations: [
                {
                  quote:
                    mode === "explain-wrong"
                      ? "return 9;"
                      : "return x * scale;",
                  explanation: "선택한 함수의 반환 원문입니다.",
                },
              ],
              inputChecks: "입력을 검사하지 않습니다.",
              callerRequirements: "숫자 입력을 전제로 설명합니다.",
              examples: [],
            }),
          },
        }),
      );
      return;
    }
    const quote = mode.startsWith("format-")
      ? "if (ready) run(); else wait();"
      : mode.startsWith("sql-")
        ? "3000"
        : mode === "invalid"
          ? "const fee = 3000;"
          : "fee = 3000";
    assert.ok(input.source.includes(quote));
    const edits = mode.startsWith("format-")
      ? [
          {
            before: quote,
            after:
              mode === "format-valid"
                ? "if (ready)\n  run();\nelse\n  wait();"
                : "if (ready) { run(); } else { wait(); }",
            reason: "서식만 바꿨다는 잘못된 모델 설명",
          },
        ]
      : mode.startsWith("sql-")
        ? [
            {
              before: quote,
              after: mode === "sql-valid" ? "4000" : ")",
              reason: "SQLite 문법 검증용 변경",
            },
          ]
        : mode.startsWith("go-") ||
            mode.startsWith("java-") ||
            mode.startsWith("csharp-") ||
            mode.startsWith("rust-")
          ? [
              {
                before: quote,
                after: mode.endsWith("-invalid") ? "fee = " : "fee = 4000",
                reason: "언어별 문법 검증용 변경",
              },
            ]
          : mode === "invalid"
            ? [
                {
                  before: quote,
                  after: "const fee = ;",
                  reason: "문법 오류 검증용",
                },
              ]
            : [
                {
                  before: "fee = 3000",
                  after: "fee = 4000",
                  reason: "배송비 변경",
                },
                {
                  before: "threshold = 50000",
                  after: "threshold = 70000",
                  reason: "기준 변경",
                },
              ];
    const citations = edits.map((edit) => ({
      quote: edit.before,
      explanation: "변경 지점의 원문",
    }));
    res.end(
      JSON.stringify({
        done: true,
        done_reason: "stop",
        message: {
          content: JSON.stringify({
            summary: "검증용 제안",
            citations,
            edits,
            risks: [],
            checks: ["실제 프로젝트 테스트 필요"],
          }),
        },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const config = vscode.workspace.getConfiguration("pureobom"),
    oldPort = config.inspect<number>("ollamaPort")?.globalValue,
    oldJavaHome = config.inspect<string>("analysisJavaHome")?.globalValue;
  await config.update(
    "ollamaPort",
    (server.address() as AddressInfo).port,
    vscode.ConfigurationTarget.Global,
  );
  const source = "# Python fixture\nfee = 3000\nthreshold = 50000\n";
  const root = vscode.workspace.workspaceFolders![0].uri;
  const uri = vscode.Uri.joinPath(root, "local-assistant-fixture.py");
  await vscode.workspace.fs.writeFile(uri, Buffer.from(source));
  try {
    const focusSource =
      "const scale = 2;\nfunction double(x) { return x * scale; }\nfunction other() { return 9; }\n";
    const focusDoc = await vscode.workspace.openTextDocument({
      language: "javascript",
      content: focusSource,
    });
    try {
      await vscode.window.showTextDocument(focusDoc, vscode.ViewColumn.One);
      await c.setDocument(focusDoc);
      await ready();
      const selected = c.state.analysis!.functions.find(
        (f) => f.name === "double",
      )!;
      const focusedPayload = {
        model: model.name,
        task: "explain",
        lang: "ko",
        instruction: "",
        focusFunctionId: selected.id,
        processor: "cpu",
      };
      mode = "explain-focus";
      chatSeen = false;
      await assert.rejects(
        c.assistant.generate(c.state.contextId, {
          ...focusedPayload,
          focusFunctionId: "missing",
        }),
        /Select a function/,
      );
      await assert.rejects(
        c.assistant.generate(c.state.contextId, {
          ...focusedPayload,
          task: "edit",
        }),
        /requires an explanation/,
      );
      assert.equal(chatSeen, false);
      await assert.rejects(
        c.assistant.generate(c.state.contextId, {
          ...focusedPayload,
          processor: "unrecognized",
        }),
        /inference processor/,
      );
      assert.equal(chatSeen, false);
      const focused = await c.assistant.generate(
        c.state.contextId,
        focusedPayload,
      );
      assert.equal(
        focusRequest!.source.before +
          focusRequest!.source.selectedFunction +
          focusRequest!.source.after,
        focusSource,
      );
      assert.equal(
        focusRequest!.source.selectedFunction,
        focusSource.slice(selected.start, selected.end),
      );
      assert.equal(focusRequest!.explanationFocus.name, "double");
      assert.equal(focusRequest!.explanationFocus.startLine, 2);
      assert.equal(focusProcessor, 0);
      assert.equal(focused.processor, "cpu");
      assert.deepEqual(focused.focus, { name: "double", line: 2, endLine: 2 });
      assert.equal(focused.edits.length, 0);
      assert.equal(focusDoc.getText(), focusSource);
      await c.assistant.source(focused.id, c.state.contextId, 0);
      assert.equal(
        focusDoc.getText(vscode.window.activeTextEditor!.selection),
        "return x * scale;",
      );
      mode = "explain-wrong";
      await assert.rejects(
        c.assistant.generate(c.state.contextId, focusedPayload),
        /inside the selected function/,
      );
      const staleContext = c.state.contextId;
      const editor = await vscode.window.showTextDocument(
        focusDoc,
        vscode.ViewColumn.One,
      );
      await editor.edit((b) =>
        b.insert(new vscode.Position(0, 0), "// changed\n"),
      );
      await c.refresh();
      await ready();
      chatSeen = false;
      await assert.rejects(c.assistant.generate(staleContext, focusedPayload));
      assert.equal(chatSeen, false);
      await vscode.commands.executeCommand("undo");
      assert.equal(focusDoc.getText(), focusSource);
      reports.push(
        "Focused local explanation: host resolves the selected function, separates its source while preserving every full-file character, rejects unknown/stale/edit focus and invalid processor before sending, forwards explicit CPU selection and no-truncation flags, requires an in-function citation and navigates exact source without edits; controlled model response",
      );
    } finally {
      for (const group of vscode.window.tabGroups.all)
        for (const tab of group.tabs) {
          if (
            tab.input instanceof vscode.TabInputText &&
            tab.input.uri.toString() === focusDoc.uri.toString()
          )
            await vscode.window.tabGroups.close(tab);
        }
      mode = "normal";
    }
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
    await c.setDocument(doc);
    await ready();
    assert.equal(c.state.language, "python");
    assert.equal(c.state.analysis!.kind, "script");
    assert.ok(
      c.state.analysis!.python?.version,
      "Python uses its own installed AST parser",
    );
    assert.deepEqual(
      c.state.analysis!.rules.map(({ name, raw, syntax }) => ({
        name,
        raw,
        syntax,
      })),
      [
        { name: "fee", raw: "3000", syntax: "python" },
        { name: "threshold", raw: "50000", syntax: "python" },
      ],
    );
    const payload = {
      model: model.name,
      task: "edit",
      lang: "ko",
      instruction: "배송비와 기준을 바꿔줘",
    };
    const result = await c.assistant.generate(c.state.contextId, payload);
    assert.ok(
      ["syntax-passed", "unavailable"].includes(result.validation.status),
      "Python syntax is checked when the local interpreter is available",
    );
    assert.equal(
      doc.getText(),
      source,
      "generation must not modify the editor",
    );
    await c.assistant.source(result.id, c.state.contextId, 0);
    assert.equal(
      doc.getText(vscode.window.activeTextEditor!.selection),
      "fee = 3000",
    );
    await assert.rejects(
      () => c.assistant.apply(result.id, c.state.contextId, true),
      /diff first/,
    );
    const preview = await c.assistant.preview(result.id, c.state.contextId);
    const after = await vscode.workspace.openTextDocument(
      vscode.Uri.parse(preview.after),
    );
    assert.ok(after.getText().includes("fee = 4000\nthreshold = 70000"));
    assert.ok(preview.after.endsWith(".py"));
    await assert.rejects(
      () => c.assistant.apply(result.id, c.state.contextId, false),
      /Acknowledge/,
    );
    await c.assistant.apply(result.id, c.state.contextId, true);
    await ready();
    assert.ok(doc.getText().includes("fee = 4000\nthreshold = 70000"));
    assert.equal(
      Buffer.from(await vscode.workspace.fs.readFile(uri)).toString(),
      source,
    );
    await vscode.commands.executeCommand("undo");
    await ready();
    assert.equal(doc.getText(), source, "one undo restores both edit ranges");
    reports.push(
      "local AI controlled fixture: actual Python document, source quote selection, native diff, explicit apply, two-range undo and no implicit save",
    );

    const staleContext = c.state.contextId;
    const stale = await c.assistant.generate(staleContext, payload);
    const editor = await vscode.window.showTextDocument(
      doc,
      vscode.ViewColumn.One,
    );
    await editor.edit((b) =>
      b.insert(new vscode.Position(0, 0), "# intervening edit\n"),
    );
    await ready();
    await assert.rejects(() => c.assistant.preview(stale.id, staleContext));
    await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: false,
    });
    await vscode.commands.executeCommand(
      "workbench.action.focusActiveEditorGroup",
    );
    assert.equal(vscode.window.activeTextEditor?.document, doc);
    await vscode.commands.executeCommand("undo");
    assert.equal(
      doc.getText(),
      source,
      "restore the intervening fixture edit before cancellation",
    );
    await c.refresh();
    await ready();
    mode = "hold";
    chatSeen = false;
    const cancelled = c.assistant.generate(c.state.contextId, payload);
    // Attach rejection immediately; the document-change event can cancel asynchronously.
    const cancellation = assert.rejects(cancelled, /cancelled|changed/);
    const deadline = Date.now() + 10000;
    while (!chatSeen && Date.now() < deadline)
      await new Promise((r) => setTimeout(r, 20));
    assert.ok(chatSeen);
    c.assistant.cancel();
    await cancellation;
    assert.equal(doc.getText(), source);
    reports.push(
      "local AI controlled fixture: stale proposal blocked and in-flight request cancelled without changing source",
    );

    mode = "invalid";
    const tsDoc = await vscode.workspace.openTextDocument({
      language: "typescript",
      content: "const fee = 3000;\n",
    });
    await vscode.window.showTextDocument(tsDoc, vscode.ViewColumn.One);
    await c.setDocument(tsDoc);
    await ready();
    const invalid = await c.assistant.generate(c.state.contextId, {
      ...payload,
      editConstraint: "whitespace-only",
    });
    assert.equal(invalid.validation.status, "syntax-failed");
    assert.deepEqual(invalid.validation.changeFacts, { status: "unavailable" });
    assert.equal(invalid.constraint?.status, "unavailable");
    await c.assistant.preview(invalid.id, c.state.contextId);
    await assert.rejects(
      () => c.assistant.apply(invalid.id, c.state.contextId, true),
      /syntax-invalid/,
    );
    assert.equal(tsDoc.getText(), "const fee = 3000;\n");
    reports.push(
      "local AI controlled fixture: malformed TypeScript proposal remains reviewable but cannot be applied",
    );

    mode = "format-with-braces";
    const formatSource = "if (ready) run(); else wait();\n";
    const formatDoc = await vscode.workspace.openTextDocument({
      language: "typescript",
      content: formatSource,
    });
    await vscode.window.showTextDocument(formatDoc, vscode.ViewColumn.One);
    await c.setDocument(formatDoc);
    await ready();
    const formatting = await c.assistant.generate(c.state.contextId, {
      ...payload,
      instruction: "줄바꿈과 들여쓰기만 바꿔줘. 중괄호를 유지해줘.",
    });
    assert.equal(formatting.validation.status, "syntax-passed");
    assert.equal(formatting.constraint, undefined);
    assert.deepEqual(formatting.validation.changeFacts, {
      status: "available",
      codeTokensChanged: true,
      parseStructureChanged: true,
      commentsChanged: false,
      whitespaceOnly: false,
      braces: { before: 0, after: 4 },
    });
    await c.assistant.preview(formatting.id, c.state.contextId);
    assert.equal(formatDoc.getText(), formatSource);
    reports.push(
      "local AI controlled fixture: source comparison exposes added braces and changed structure despite the model claiming formatting; proposal preview leaves source unchanged",
    );
    const constrainedPayload = {
      ...payload,
      instruction: "줄바꿈과 들여쓰기만 바꿔줘. 중괄호를 유지해줘.",
      editConstraint: "whitespace-only",
    };
    const rejectedFormat = await c.assistant.generate(
      c.state.contextId,
      constrainedPayload,
    );
    assert.equal(rejectedFormat.validation.status, "syntax-passed");
    assert.equal(rejectedFormat.constraint?.status, "failed");
    await c.assistant.preview(rejectedFormat.id, c.state.contextId);
    await assert.rejects(
      c.assistant.apply(rejectedFormat.id, c.state.contextId, true),
      /whitespace-only constraint/,
    );
    assert.equal(formatDoc.getText(), formatSource);
    reports.push(
      "local AI controlled fixture: explicit spacing-only restriction blocks a syntax-valid brace-changing proposal at the host even after diff review and acknowledgment",
    );
    mode = "format-valid";
    const acceptedFormat = await c.assistant.generate(
      c.state.contextId,
      constrainedPayload,
    );
    assert.equal(acceptedFormat.constraint?.status, "passed");
    await c.assistant.preview(acceptedFormat.id, c.state.contextId);
    await c.assistant.apply(acceptedFormat.id, c.state.contextId, true);
    await ready();
    assert.equal(
      formatDoc.getText(),
      "if (ready)\n  run();\nelse\n  wait();\n",
    );
    await vscode.window.showTextDocument(formatDoc, {
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: false,
    });
    await vscode.commands.executeCommand("undo");
    await ready();
    assert.equal(formatDoc.getText(), formatSource);
    reports.push(
      "local AI controlled fixture: verified spacing-only proposal previews, applies and native undo restores the exact original without changing its code tokens or syntax structure",
    );

    const goDoc = await vscode.workspace.openTextDocument({
      language: "go",
      content: "package sample\nconst fee = 3000\n",
    });
    await vscode.window.showTextDocument(goDoc, vscode.ViewColumn.One);
    await c.setDocument(goDoc);
    await ready();
    assert.ok(c.state.analysis!.go);
    mode = "go-valid";
    const validGo = await c.assistant.generate(c.state.contextId, payload);
    assert.equal(validGo.validation.status, "syntax-passed");
    assert.match(
      validGo.validation.detail,
      /types, ranges, behavior and performance unchecked/,
    );
    mode = "go-invalid";
    const invalidGo = await c.assistant.generate(c.state.contextId, payload);
    assert.equal(invalidGo.validation.status, "syntax-failed");
    const goPreview = await c.assistant.preview(
      invalidGo.id,
      c.state.contextId,
    );
    assert.ok(goPreview.after.endsWith(".go"));
    await assert.rejects(
      () => c.assistant.apply(invalidGo.id, c.state.contextId, true),
      /syntax-invalid/,
    );
    assert.equal(goDoc.getText(), "package sample\nconst fee = 3000\n");
    reports.push(
      "local AI controlled fixture: actual Go parser accepts valid syntax, rejects a malformed proposal, preserves native Go diff and blocks invalid apply without claiming type checks",
    );
    await config.update(
      "analysisJavaHome",
      process.env.PUREOBOM_TEST_JAVA_HOME || process.env.JAVA_HOME || "",
      vscode.ConfigurationTarget.Global,
    );
    const javaDoc = await vscode.workspace.openTextDocument({
      language: "java",
      content: "class Sample { int fee = 3000; }\n",
    });
    await vscode.window.showTextDocument(javaDoc, vscode.ViewColumn.One);
    await c.setDocument(javaDoc);
    await ready();
    assert.ok(c.state.analysis!.java);
    mode = "java-valid";
    const validJava = await c.assistant.generate(c.state.contextId, payload);
    assert.equal(validJava.validation.status, "syntax-passed");
    assert.match(
      validJava.validation.detail,
      /types, dependencies, behavior and performance unchecked/,
    );
    mode = "java-invalid";
    const invalidJava = await c.assistant.generate(c.state.contextId, payload);
    assert.equal(invalidJava.validation.status, "syntax-failed");
    const javaPreview = await c.assistant.preview(
      invalidJava.id,
      c.state.contextId,
    );
    assert.ok(javaPreview.after.endsWith(".java"));
    await assert.rejects(
      () => c.assistant.apply(invalidJava.id, c.state.contextId, true),
      /syntax-invalid/,
    );
    assert.equal(javaDoc.getText(), "class Sample { int fee = 3000; }\n");
    reports.push(
      "local AI controlled fixture: actual Java parser accepts valid syntax, rejects a malformed proposal, preserves native Java diff and blocks invalid apply without claiming type or dependency checks",
    );
    const previousDotnet =
      config.inspect<string>("analysisDotnet")?.globalValue;
    await config.update(
      "analysisDotnet",
      process.env.PUREOBOM_TEST_DOTNET || "",
      vscode.ConfigurationTarget.Global,
    );
    try {
      const csharpDoc = await vscode.workspace.openTextDocument({
        language: "csharp",
        content: "class Sample { int fee = 3000; }\n",
      });
      await vscode.window.showTextDocument(csharpDoc, vscode.ViewColumn.One);
      await c.setDocument(csharpDoc);
      await ready();
      assert.ok(c.state.analysis!.csharp);
      mode = "csharp-valid";
      const validCSharp = await c.assistant.generate(
        c.state.contextId,
        payload,
      );
      assert.equal(validCSharp.validation.status, "syntax-passed");
      assert.match(
        validCSharp.validation.detail,
        /types, dependencies, behavior and performance unchecked/,
      );
      mode = "csharp-invalid";
      const invalidCSharp = await c.assistant.generate(
        c.state.contextId,
        payload,
      );
      assert.equal(invalidCSharp.validation.status, "syntax-failed");
      const csharpPreview = await c.assistant.preview(
        invalidCSharp.id,
        c.state.contextId,
      );
      assert.ok(csharpPreview.after.endsWith(".cs"));
      await assert.rejects(
        () => c.assistant.apply(invalidCSharp.id, c.state.contextId, true),
        /syntax-invalid/,
      );
      assert.equal(csharpDoc.getText(), "class Sample { int fee = 3000; }\n");
      reports.push(
        "local AI controlled fixture: actual C# parser accepts valid syntax, rejects a malformed proposal, preserves native C# diff and blocks invalid apply without claiming type or dependency checks",
      );
    } finally {
      await config.update(
        "analysisDotnet",
        previousDotnet,
        vscode.ConfigurationTarget.Global,
      );
    }
    const rustDoc = await vscode.workspace.openTextDocument({
      language: "rust",
      content: "fn value()->bool { let fee = 3000; fee }\n",
    });
    await vscode.window.showTextDocument(rustDoc, vscode.ViewColumn.One);
    await c.setDocument(rustDoc);
    await ready();
    mode = "rust-valid";
    const validRust = await c.assistant.generate(c.state.contextId, payload);
    assert.equal(validRust.validation.status, "syntax-passed");
    assert.match(
      validRust.validation.detail,
      /compilation, types, ownership, macros, cfg, behavior and performance unchecked/,
    );
    mode = "rust-invalid";
    const invalidRust = await c.assistant.generate(c.state.contextId, payload);
    assert.equal(invalidRust.validation.status, "syntax-failed");
    const rustPreview = await c.assistant.preview(
      invalidRust.id,
      c.state.contextId,
    );
    assert.ok(rustPreview.after.endsWith(".rs"));
    await assert.rejects(
      c.assistant.apply(invalidRust.id, c.state.contextId, true),
      /syntax-invalid/,
    );
    assert.equal(
      rustDoc.getText(),
      "fn value()->bool { let fee = 3000; fee }\n",
    );
    reports.push(
      "local AI controlled fixture: bundled Rust syntax check accepts syntactically valid but type-invalid code, rejects malformed proposal, preserves native Rust diff and blocks invalid apply",
    );
    const sqlDoc = await vscode.workspace.openTextDocument({
      language: "sql",
      content: "SELECT 3000 AS fee;",
    });
    await vscode.window.showTextDocument(sqlDoc, vscode.ViewColumn.One);
    await c.setDocument(sqlDoc);
    await ready();
    mode = "sql-valid";
    const unspecified = await c.assistant.generate(c.state.contextId, payload);
    assert.equal(unspecified.validation.status, "unavailable");
    await c.setSqlDialect(c.state.contextId, "sqlite");
    await ready();
    const validSql = await c.assistant.generate(c.state.contextId, payload);
    assert.equal(validSql.validation.status, "syntax-passed");
    assert.match(
      validSql.validation.detail,
      /results and performance unchecked/,
    );
    mode = "sql-invalid";
    const invalidSql = await c.assistant.generate(c.state.contextId, payload);
    assert.equal(invalidSql.validation.status, "syntax-failed");
    const sqlPreview = await c.assistant.preview(
      invalidSql.id,
      c.state.contextId,
    );
    assert.ok(sqlPreview.after.endsWith(".sql"));
    await assert.rejects(
      c.assistant.apply(invalidSql.id, c.state.contextId, true),
      /syntax-invalid/,
    );
    assert.equal(sqlDoc.getText(), "SELECT 3000 AS fee;");
    reports.push(
      "local AI controlled fixture: unspecified SQL remains unchecked, explicitly selected SQLite parses a valid proposal, rejects malformed SQL, preserves SQL diff and blocks invalid apply",
    );
  } finally {
    c.assistant.cancel();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await config.update(
      "ollamaPort",
      oldPort,
      vscode.ConfigurationTarget.Global,
    );
    await config.update(
      "analysisJavaHome",
      oldJavaHome,
      vscode.ConfigurationTarget.Global,
    );
  }
}
