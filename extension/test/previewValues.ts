import * as assert from "node:assert/strict";
import * as vscode from "vscode";
import type { Controller } from "../src/controller";
import type { ScenarioReport } from "../../src/core/scenarioModel";
import type { Simulation } from "../../src/core/types";
import {
  encodePreviewMessage,
  decodePreviewMessage,
  displayValue,
} from "../../src/core/previewValues";
import { scenarioMarkdown } from "../../src/core/report";

export async function previewValueChecks(
  c: Controller,
  ready: () => Promise<void>,
  reports: string[],
) {
  const originalEditor = vscode.window.activeTextEditor;
  const source =
    'export function values(input: number) { return { ratio: input/input, reciprocal: 1/input, absent: undefined, literal: null, text: "NaN", zero: input }; }';
  const doc = await vscode.workspace.openTextDocument({
    language: "typescript",
    content: source,
  });
  let panel: vscode.WebviewPanel | undefined;
  try {
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
    await c.setDocument(doc);
    await ready();
    const input = decodePreviewMessage(
      JSON.parse(
        JSON.stringify(
          encodePreviewMessage([{ label: "negative zero", args: [-0] }]),
        ),
      ),
    ) as { label: string; args: unknown[] }[];
    const simulation = await c.simulate(c.state.contextId, "values", "[-0]");
    const comparison = await c.compare(c.state.contextId, "values", input);
    assert.equal(simulation.ok, true);
    panel = vscode.window.createWebviewPanel(
      "pureobom.previewValueTest",
      "Preview value transport test",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: true },
    );
    const activePanel = panel;
    let receiver: vscode.Disposable | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const response = new Promise<{ encoded: unknown; plain: Simulation }>(
      (resolve, reject) => {
        timer = setTimeout(
          () => reject(Error("Actual webview transport did not respond")),
          25000,
        );
        receiver = activePanel.webview.onDidReceiveMessage((data) => {
          if (data?.ready)
            void activePanel.webview
              .postMessage({
                encoded: encodePreviewMessage({ simulation, comparison }),
                plain: simulation,
              })
              .then((sent) => {
                if (!sent) reject(Error("Webview message was not delivered"));
              }, reject);
          else resolve(data);
        });
      },
    );
    panel.webview.html =
      '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'nonce-test\'"><p>Calculation value transport test</p><script nonce="test">const host=acquireVsCodeApi();window.addEventListener("message",e=>host.postMessage(e.data));host.postMessage({ready:true});</script>';
    let echoed: { encoded: unknown; plain: Simulation };
    try {
      echoed = await response;
    } finally {
      clearTimeout(timer);
      receiver?.dispose();
    }
    const actual = decodePreviewMessage(echoed.encoded) as {
      simulation: Simulation;
      comparison: ScenarioReport;
    };
    assert.equal(
      (echoed.plain.result as Record<string, unknown>).ratio,
      null,
      "control confirms the actual JSON boundary loses NaN",
    );
    assert.equal(
      displayValue(actual.simulation.result),
      '{"ratio": NaN, "reciprocal": -Infinity, "absent": undefined, "literal": null, "text": "NaN", "zero": -0}',
    );
    assert.ok(
      actual.simulation.trace.some(
        (step) =>
          step.text.startsWith("결과 / return:") &&
          step.text.includes('"reciprocal": -Infinity'),
      ),
    );
    assert.equal(displayValue(actual.comparison.rows[0].args), "[-0]");
    const md = scenarioMarkdown(actual.comparison, "en");
    for (const token of ["NaN", "-Infinity", "undefined", "-0", "null"])
      assert.ok(md.includes(token));
    assert.equal(doc.getText(), source);
    reports.push(
      "Preview values: actual worker/controller and two-way VS Code webview JSON transport preserve NaN, infinities, negative-zero inputs/results and present undefined properties; ordinary strings stay distinct in trace, comparison and Markdown without source edits",
    );
  } finally {
    panel?.dispose();
    if (originalEditor) {
      await vscode.window.showTextDocument(
        originalEditor.document,
        vscode.ViewColumn.One,
      );
      await c.setDocument(originalEditor.document);
      await ready();
    }
  }
}
