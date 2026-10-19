import { describe, expect, it } from "vitest";
import { simulate } from "../src/core/simulate";
import { analyzeFile } from "../src/core/analyze";
import { observeFunction } from "../src/core/assistantObservations";
import {
  encodePreviewMessage,
  decodePreviewMessage,
} from "../src/core/previewValues";
import type { Simulation } from "../src/core/types";

function calculate(content: string, args: unknown[] = []) {
  return simulate(
    [{ path: "calculation.ts", content }],
    "calculation.ts",
    "f",
    args,
  );
}

describe("evaluated arithmetic records", () => {
  it("shows operands and results for supported arithmetic at the actual operator line", () => {
    const r = calculate(
      "export function f(a: number, b: number) {\nreturn [a+b,a-b,a*b,a/b,a%b,a**b];\n}",
      [7, 3],
    );
    expect(r.ok).toBe(true);
    expect(r.result).toEqual([10, 4, 21, 7 / 3, 1, 343]);
    const steps = r.trace.filter((s) =>
      s.text.startsWith("계산 / arithmetic:"),
    );
    expect(steps).toHaveLength(6);
    expect(
      steps.every((s) => s.path === "calculation.ts" && s.line === 2),
    ).toBe(true);
    expect(steps[3].text).toBe(
      "계산 / arithmetic: a/b\n7 / 3 → 2.3333333333333335",
    );
    expect(steps[4].text).toBe("계산 / arithmetic: a%b\n7 % 3 → 1");
  });
  it("does not reevaluate operands with side effects and records pre-assignment values", () => {
    const r = calculate(
      "function f(){let n=1; const ratio=n++ / n++; let x=5; x /= x++; return [ratio,n,x];}",
    );
    expect(r.ok).toBe(true);
    expect(r.result).toEqual([0.5, 3, 1]);
    expect(
      r.trace.some(
        (s) => s.text === "계산 / arithmetic: n++ / n++\n1 / 2 → 0.5",
      ),
    ).toBe(true);
    expect(
      r.trace.some((s) => s.text === "계산 / arithmetic: x /= x++\n5 / 5 → 1"),
    ).toBe(true);
  });
  it("does not record arithmetic in skipped short-circuit or conditional branches", () => {
    const r = calculate(
      "function f(){let x=0; const a=false && (1/0); const b=true ? 2 : 0/0; const c=4 ?? (x++ / 0); return [a,b,c,x];}",
    );
    expect(r.ok).toBe(true);
    expect(r.result).toEqual([false, 2, 4, 0]);
    expect(r.trace.some((s) => s.text.includes("arithmetic:"))).toBe(false);
  });
  it("preserves NaN, signed infinity, signed zero and string coercion across worker transport", () => {
    const r = decodePreviewMessage(
      JSON.parse(
        JSON.stringify(
          encodePreviewMessage(
            calculate(
              'function f(){ return [0/0,1/0,1/-0,-0/1,"2"+3,"2"*3]; }',
            ),
          ),
        ),
      ),
    ) as Simulation;
    expect(r.ok).toBe(true);
    const values = r.result as unknown[];
    expect(Number.isNaN(values[0])).toBe(true);
    expect(values.slice(1, 3)).toEqual([Infinity, -Infinity]);
    expect(Object.is(values[3], -0)).toBe(true);
    expect(values.slice(4)).toEqual(["23", 6]);
    expect(r.trace.filter((s) => s.nonFiniteArithmetic)).toHaveLength(3);
    expect(r.trace.some((s) => s.text.includes("-0 / 1 → -0"))).toBe(true);
    expect(r.trace.some((s) => s.text.includes('"2" + 3 → "23"'))).toBe(true);
  });
  it("keeps early non-finite arithmetic from the middle of a long current-file observation", () => {
    const file = {
      path: "limited.ts",
      content:
        "function f(){let x=0;while(x<20){if(x>=0)x++;}const ratio=0/0;while(x<40){if(x>=0)x++;}return ratio;}",
    };
    const target = analyzeFile(file).functions[0];
    const [row] = observeFunction([file], file.path, target, "[[]]");
    expect(row.status).toBe("returned");
    expect(row.value).toBe("NaN");
    expect(row.execution?.omitted).toBe(true);
    expect(row.execution?.steps).toHaveLength(12);
    expect(
      row.execution?.steps.some((s) => s.text.includes("0 / 0 → NaN")),
    ).toBe(true);
    const orders = row.execution!.steps.map((s) => s.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(row.execution?.steps.at(-1)?.text).toBe("결과 / return: NaN");
  });
  it("keeps exact results while excluding oversized expression records from model evidence", () => {
    const file = {
      path: "large.ts",
      content: 'function f(){return "' + "x".repeat(900) + '" + "y";}',
    };
    const [row] = observeFunction(
      [file],
      file.path,
      analyzeFile(file).functions[0],
      "[[]]",
    );
    expect(row.status).toBe("returned");
    expect(row.value).toBe('"' + "x".repeat(900) + 'y"');
    expect(row.execution).toEqual({ steps: [], omitted: true });
  });
});
