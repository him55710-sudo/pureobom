import { describe, it, expect } from "vitest";
import { analyzeFile } from "../src/core/analyze";
import { makePatch } from "../src/core/edit";
import { compareScenarios } from "../src/core/scenarios";
import { displayValue, suggestScenarios } from "../src/core/scenarioModel";
import { scenarioMarkdown } from "../src/core/report";
import { demo } from "../src/demo";

const file = demo[0];
const analysis = analyzeFile(file);
const rule = analysis.rules.find((r) => r.name === "freeShippingThreshold")!;
const patch = makePatch(file, rule.id, "70000");
describe("scenario comparison", () => {
  it("finds a change that a single happy-path input misses", () => {
    const report = compareScenarios(
      demo,
      file.path,
      "calculateShipping",
      [49999, 50000, 60000, 70000].map((n) => ({
        label: String(n),
        args: [n],
      })),
      patch,
    );
    expect(report.rows.map((r) => r.status)).toEqual([
      "same",
      "changed",
      "changed",
      "same",
    ]);
    expect(report.rows[2].before.result).toBe(0);
    expect(report.rows[2].after?.result).toBe(3000);
    expect(file.content).toContain("50000");
  });
  it("never calls an unsupported or throwing case a pass", () => {
    expect(
      compareScenarios(
        demo,
        file.path,
        "calculateShipping",
        [{ label: "negative", args: [-1] }],
        patch,
      ).rows[0].status,
    ).toBe("unavailable");
    expect(
      compareScenarios(demo, "src/products.ts", "loadProducts", [
        { label: "fetch", args: [] },
      ]).rows[0].status,
    ).toBe("unavailable");
  });
  it("rejects stale sources and unbounded inputs", () => {
    expect(() =>
      compareScenarios(
        [{ ...file, content: file.content + "\n" }],
        file.path,
        "calculateShipping",
        [{ label: "1", args: [0] }],
        patch,
      ),
    ).toThrow(/source changed/);
    expect(() =>
      compareScenarios(
        demo,
        file.path,
        "calculateShipping",
        Array(13).fill({ label: "1", args: [] }),
      ),
    ).toThrow(/1–12/);
    expect(() =>
      compareScenarios(demo, file.path, "calculateShipping", []),
    ).toThrow();
  });
  it.each([
    ['"NaN"', "0 / 0", "changed"],
    ["{ a: 1, b: undefined }", "{ b: undefined, a: 1 }", "same"],
    ["{ a: undefined }", "{}", "changed"],
    ["-0", "0", "changed"],
    ["[]", "[,]", "changed"],
    ["[,]", "[undefined]", "changed"],
    ["[,1]", "[1,,]", "changed"],
    ["[,1]", "[,1]", "same"],
    ["[[]]", "[[,]]", "changed"],
    ["[,,]", "[,]", "changed"],
    ["{ a: [,] }", "{ a: [] }", "changed"],
  ])("compares %s and %s without JSON coercion", (before, after, status) => {
    const source = {
      path: "values.ts",
      content: `const chooseBefore = true; export function result() { if (chooseBefore) return ${before}; return ${after}; }`,
    };
    const p = makePatch(source, analyzeFile(source).rules[0].id, "false");
    expect(
      compareScenarios(
        [source],
        source.path,
        "result",
        [{ label: "1", args: [] }],
        p,
      ).rows[0].status,
    ).toBe(status);
  });
  it("displays special values distinctly from strings", () => {
    expect(displayValue({ value: NaN })).toBe('{"value": NaN}');
    expect(displayValue({ value: "NaN" })).toBe('{"value": "NaN"}');
    expect(displayValue([undefined, null, -0])).toBe("[undefined, null, -0]");
  });
  it("suggests both old and new numeric boundaries", () => {
    const cases = suggestScenarios(
      analysis.functions[0],
      analysis.rules,
      "70000",
    );
    expect(cases.map((c) => c.args[0])).toContain(70000);
    expect(cases.length).toBeLessThanOrEqual(12);
  });
  it("exports only displayed evidence and escapes Markdown/HTML", () => {
    const report = compareScenarios(
      demo,
      file.path,
      "calculateShipping",
      [{ label: "<img src=x>|[click](https://evil.test)", args: [60000] }],
      patch,
    );
    const md = scenarioMarkdown(report, "en");
    expect(md).toContain("3000");
    expect(md).toContain("not an app execution");
    expect(md).not.toContain("<img");
    expect(md).not.toContain("[click]");
    expect(md).not.toContain("export function");
  });
});
