import * as assert from "node:assert/strict";
import * as vscode from "vscode";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Controller } from "../src/controller";

export async function explanationObservationChecks(
  c: Controller,
  ready: () => Promise<void>,
  reports: string[],
) {
  const previousEditor = vscode.window.activeTextEditor;
  const config = vscode.workspace.getConfiguration("pureobom");
  const previousPort = config.inspect<number>("ollamaPort")?.globalValue;
  const source =
    "export function sample(x: number) { return { ratio: x/x, reciprocal: 1/x, value: x }; }\nfunction other(x: number) { return x; }\n";
  let requests = 0,
    chats = 0;
  let received: Record<string, any> | undefined;
  const model = {
    name: "fixture:observations",
    size: 1900000000,
    digest: "b".repeat(64),
    details: { format: "gguf" },
  };
  const server = createServer(async (req, res) => {
    requests++;
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length
      ? JSON.parse(Buffer.concat(chunks).toString())
      : {};
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/api/status")
      res.end(JSON.stringify({ cloud: { disabled: true } }));
    else if (req.url === "/api/tags")
      res.end(JSON.stringify({ models: [model] }));
    else if (req.url === "/api/show")
      res.end(
        JSON.stringify({
          details: { format: "gguf" },
          model_info: { "general.architecture": "fixture" },
          capabilities: ["completion"],
        }),
      );
    else {
      chats++;
      received = JSON.parse(body.messages[1].content);
      res.end(
        JSON.stringify({
          done: true,
          done_reason: "stop",
          message: {
            content: JSON.stringify({
              summary:
                "Controlled fixture response, not a semantic quality assessment.",
              citations: [
                {
                  quote: "return { ratio: x/x, reciprocal: 1/x, value: x };",
                  explanation: "Source return expression.",
                },
              ],
              edits: [],
              risks: [],
              checks: [],
            }),
          },
        }),
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await config.update(
      "ollamaPort",
      (server.address() as AddressInfo).port,
      vscode.ConfigurationTarget.Global,
    );
    const doc = await vscode.workspace.openTextDocument({
      language: "typescript",
      content: source,
    });
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
    await c.setDocument(doc);
    await ready();
    const target = () =>
      c.state.analysis!.functions.find((f) => f.name === "sample")!;
    const args = { focusFunctionId: target().id, inputs: "[[0],[-0],[2]]" };
    const observed = await c.assistant.observe(c.state.contextId, args);
    const expected = structuredClone(observed.items);
    assert.equal(requests, 0, "observations do not contact Ollama");
    assert.equal(
      expected[0].value,
      '{"ratio": NaN, "reciprocal": Infinity, "value": 0}',
    );
    assert.equal(expected[1].args, "[-0]");
    assert.equal(
      expected[1].value,
      '{"ratio": NaN, "reciprocal": -Infinity, "value": -0}',
    );
    await assert.rejects(
      c.assistant.observe(c.state.contextId, { ...args, inputs: "[1]" }),
    );
    assert.equal(requests, 0);
    reports.push(
      "Explanation observations: actual worker calculates selected JS/TS examples and preserves special values without contacting any model; invalid argument lists are rejected",
    );

    const payload = {
      model: model.name,
      task: "explain",
      lang: "en",
      instruction: "Explain these inputs.",
      focusFunctionId: target().id,
      observationId: observed.id,
      timeoutSeconds: 300,
    };
    await assert.rejects(
      c.assistant.generate(c.state.contextId, {
        ...payload,
        timeoutSeconds: 10000,
      }),
    );
    assert.equal(
      requests,
      0,
      "invalid deadlines are rejected before any model request",
    );
    observed.items[0].value = "forged client result";
    const phases: string[] = [];
    const result = await c.assistant.generate(
      c.state.contextId,
      {
        ...payload,
        observations: [
          { args: "[]", status: "returned", value: "another forgery" },
        ],
      },
      (phase) => phases.push(phase),
    );
    assert.deepEqual(phases, [
      "connection",
      "models",
      "model",
      "connection",
      "generation",
      "validation",
    ]);
    assert.deepEqual(received!.calculationObservations.cases, expected);
    assert.deepEqual(result.observations, expected);
    assert.equal(result.timeoutSeconds, 300);
    assert.equal(
      received!.source.before +
        received!.source.selectedFunction +
        received!.source.after,
      source,
    );
    assert.equal(doc.getText(), source);
    reports.push(
      "Explanation observations: host-retained results, progress phases and a selected time limit reach the actual local-model client and returned view; invalid limits and fabricated observation fields cannot replace them; full source is preserved (model answer is controlled)",
    );

    const beforeRejected = chats;
    await assert.rejects(
      c.assistant.generate(c.state.contextId, {
        ...payload,
        observationId: "forged",
      }),
    );
    await assert.rejects(
      c.assistant.generate(c.state.contextId, { ...payload, task: "edit" }),
    );
    await assert.rejects(
      c.assistant.generate(c.state.contextId, {
        ...payload,
        focusFunctionId: c.state.analysis!.functions.find(
          (f) => f.name === "other",
        )!.id,
      }),
    );
    const newer = await c.assistant.observe(c.state.contextId, args);
    await assert.rejects(c.assistant.generate(c.state.contextId, payload));
    const editor = await vscode.window.showTextDocument(
      doc,
      vscode.ViewColumn.One,
    );
    await editor.edit((edit) =>
      edit.insert(doc.positionAt(source.length), "// changed\n"),
    );
    await c.refresh();
    await ready();
    await assert.rejects(
      c.assistant.generate(c.state.contextId, {
        ...payload,
        observationId: newer.id,
        focusFunctionId: target().id,
      }),
    );
    assert.equal(
      chats,
      beforeRejected,
      "stale or mismatched observations cannot reach chat inference",
    );
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
    await vscode.commands.executeCommand("undo");
    await c.refresh();
    await ready();
    assert.equal(doc.getText(), source);
    reports.push(
      "Explanation observations: wrong handles, edit tasks, different functions, superseded examples and an edited document are rejected before model inference; native undo restores exact source",
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await config.update(
      "ollamaPort",
      previousPort,
      vscode.ConfigurationTarget.Global,
    );
    if (previousEditor) {
      await vscode.window.showTextDocument(
        previousEditor.document,
        vscode.ViewColumn.One,
      );
      await c.setDocument(previousEditor.document);
      await ready();
    }
  }
}
