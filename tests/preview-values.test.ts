import { describe, it, expect } from "vitest";
import {
  decodePreviewMessage,
  encodePreviewMessage,
  displayValue,
  specialValueKinds,
} from "../src/core/previewValues";
import { simulate } from "../src/core/simulate";
import { compareScenarios } from "../src/core/scenarios";
import { makePatch } from "../src/core/edit";
import { analyzeFile } from "../src/core/analyze";
import { scenarioMarkdown } from "../src/core/report";
import type { Simulation } from "../src/core/types";
import type { ScenarioReport } from "../src/core/scenarioModel";
const wire = (value: unknown) =>
  decodePreviewMessage(JSON.parse(JSON.stringify(encodePreviewMessage(value))));
describe("calculation values across the JSON webview boundary", () => {
  it("preserves special values, present undefined properties and confusing real strings", () => {
    const original = {
      values: [
        NaN,
        Infinity,
        -Infinity,
        -0,
        undefined,
        null,
        "NaN",
        "[NaN]",
        "undefined",
      ],
      present: undefined,
      marker: { type: "number", value: "NaN" },
    };
    const restored = wire(original) as typeof original;
    expect(restored).toEqual(original);
    expect(Object.hasOwn(restored, "present")).toBe(true);
    expect(Object.is(restored.values[3], -0)).toBe(true);
    expect(displayValue(restored.values)).toBe(
      '[NaN, Infinity, -Infinity, -0, undefined, null, "NaN", "[NaN]", "undefined"]',
    );
    expect(specialValueKinds(restored)).toEqual([
      "NaN",
      "Infinity",
      "-Infinity",
      "-0",
      "undefined",
    ]);
    expect(specialValueKinds({ text: "NaN", value: "undefined" })).toEqual([]);
  });
  it("preserves sparse positions without treating them as undefined or real marker objects", () => {
    const array = new Array(3);
    array[1] = undefined;
    array[2] = { type: "empty" };
    const restored = wire(array) as unknown[];
    expect(Object.hasOwn(restored, 0)).toBe(false);
    expect(Object.hasOwn(restored, 1)).toBe(true);
    expect(restored[2]).toEqual({ type: "empty" });
    expect(displayValue(restored)).toBe(
      '[<empty>, undefined, {"type": "empty"}]',
    );
  });
  it("does not evaluate toJSON/getters or mutate prototypes", () => {
    let calls = 0;
    expect(() =>
      wire({
        get value() {
          calls++;
          return 1;
        },
      }),
    ).toThrow();
    expect(() =>
      wire({
        toJSON() {
          calls++;
          return 1;
        },
      }),
    ).toThrow();
    expect(calls).toBe(0);
    const input = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":"data"}',
    );
    const restored = wire(input) as Record<string, unknown>;
    expect(Object.getPrototypeOf(restored)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(wire(Object.create(null)))).toBe(null);
    expect(Object.hasOwn(restored, "__proto__")).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it("rejects malformed, cyclic and oversized encodings", () => {
    const envelope = (value: unknown) => ({
      encoding: "pureobom-preview-1",
      value,
    });
    for (const invalid of [
      null,
      {},
      envelope({ type: "number", value: "surprise" }),
      envelope({
        type: "object",
        nullPrototype: false,
        value: [
          ["a", { type: "null" }],
          ["a", { type: "undefined" }],
        ],
      }),
      envelope({ type: "number", value: Infinity }),
      envelope({ type: "empty" }),
    ])
      expect(() => decodePreviewMessage(invalid)).toThrow();
    const cyclic: unknown[] = [];
    cyclic.push(cyclic);
    expect(() => encodePreviewMessage(cyclic)).toThrow();
    expect(() => encodePreviewMessage("x".repeat(250001))).toThrow(/limit/);
    expect(() =>
      decodePreviewMessage(
        envelope({ type: "string", value: "x".repeat(250001) }),
      ),
    ).toThrow(/limit/);
    const deep = Array.from({ length: 66 }).reduce<unknown>(
      (value) => [value],
      0,
    );
    expect(() => encodePreviewMessage(deep)).toThrow(/limit/);
  });
  it("keeps negative-zero inputs and actual interpreter results through both directions", () => {
    const file = {
      path: "values.ts",
      content:
        'export function reciprocal(x) { return {value:1/x,zero:x,missing:undefined,text:"NaN"}; }',
    };
    const input = wire({ args: [-0] }) as { args: unknown[] };
    const result = wire(
      simulate([file], file.path, "reciprocal", input.args),
    ) as Simulation;
    expect(result.ok).toBe(true);
    const actual = result.result as {
      value: number;
      zero: number;
      missing?: unknown;
    };
    expect(actual.value).toBe(-Infinity);
    expect(Object.is(actual.zero, -0)).toBe(true);
    expect(Object.hasOwn(actual, "missing")).toBe(true);
    expect(result.trace[0].text).toContain('"value": -Infinity');
    expect(result.trace[0].text).toContain('"missing": undefined');
  });
  it("keeps comparison status, displayed inputs/results and exported reports consistent", () => {
    const file = {
      path: "values.ts",
      content:
        "const old=true; export function f(x) { if(old) return {value:1/x, missing:undefined}; return {value:null}; }",
    };
    const patch = makePatch(file, analyzeFile(file).rules[0].id, "false");
    const report = wire(
      compareScenarios(
        [file],
        file.path,
        "f",
        [{ label: "negative zero", args: [-0] }],
        patch,
      ),
    ) as ScenarioReport;
    expect(report.rows[0].status).toBe("changed");
    expect(displayValue(report.rows[0].args)).toBe("[-0]");
    expect(displayValue(report.rows[0].before.result)).toBe(
      '{"value": -Infinity, "missing": undefined}',
    );
    const md = scenarioMarkdown(report, "en");
    expect(md).toContain("-0");
    expect(md).toContain("-Infinity");
    expect(md).toContain("undefined");
    expect(md).toContain("null");
  });
});
