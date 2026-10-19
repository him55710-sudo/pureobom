import * as assert from "node:assert/strict";
import * as vscode from "vscode";
import type { Controller } from "../src/controller";
import { displayValue } from "../../src/core/previewValues";

export async function iterationPreviewChecks(
  c: Controller,
  ready: () => Promise<void>,
  reports: string[],
) {
  const originalEditor = vscode.window.activeTextEditor;
  const source =
    "const scale=2; export function calculate(count:number){let i=0,total=0;while(i<count){i++;if(i===2)continue;total+=i;}const values=[total,count].map(x=>x*scale);return {values,last:values.at(-1)};}";
  const doc = await vscode.workspace.openTextDocument({
    language: "typescript",
    content: source,
  });
  try {
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
    await c.setDocument(doc);
    await ready();
    const first = await c.simulate(c.state.contextId, "calculate", "[3]");
    assert.equal(first.ok, true, first.error);
    assert.equal(displayValue(first.result), '{"values": [8, 6], "last": 6}');
    assert.ok(
      first.trace.some((step) => step.text.includes("loop entries: 3")),
    );
    const rule = c.state.analysis!.rules.find((rule) => rule.name === "scale")!;
    const patch = await c.prepare(c.state.contextId, {
      ruleId: rule.id,
      value: "3",
    });
    const comparison = await c.compare(
      c.state.contextId,
      "calculate",
      [{ label: "three items", args: [3] }],
      patch.id,
    );
    assert.equal(comparison.rows[0].status, "changed");
    assert.equal(
      displayValue(comparison.rows[0].before.result),
      '{"values": [8, 6], "last": 6}',
    );
    assert.equal(
      displayValue(comparison.rows[0].after?.result),
      '{"values": [12, 9], "last": 9}',
    );
    const limited = await c.simulate(
      c.state.contextId,
      "calculate",
      "[100000]",
    );
    assert.equal(limited.ok, false);
    assert.match(limited.error!, /budget/i);
    assert.equal(doc.getText(), source);
    reports.push(
      "Bounded iteration: actual worker/controller evaluates while, captured local updates, continue, map and negative at indexes; compares a prepared literal edit without changing source; excessive work remains unavailable",
    );
  } finally {
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
