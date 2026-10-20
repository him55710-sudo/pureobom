import { describe, expect, it } from "vitest";
import { analyzeFile } from "../src/core/analyze";
import { functionNesting } from "../src/core/functionNesting";

const read = (source: string) =>
  analyzeFile({ path: "sample.ts", content: source }).functions;

describe("function source nesting", () => {
  it("links only immediate nested functions and supports returning to their closest owner", () => {
    const functions = read(
      "function outer() { function inner() { return () => 1; } return inner; } function other() { return 2; }",
    );
    const outer = functions.find((f) => f.name === "outer")!;
    const inner = functions.find((f) => f.name === "inner")!;
    const leaf = functions.find((f) => f.name.startsWith("function@"))!;
    expect(
      functionNesting(functions, outer.id).children.map((f) => f.id),
    ).toEqual([inner.id]);
    expect(functionNesting(functions, inner.id)).toEqual({
      parent: outer,
      children: [leaf],
    });
    expect(functionNesting(functions, leaf.id)).toEqual({
      parent: inner,
      children: [],
    });
    expect(functionNesting(functions, "missing")).toEqual({
      parent: undefined,
      children: [],
    });
  });
  it("distinguishes same-line callbacks by their source ranges, not their shared generated name", () => {
    const source =
      "// 😀\r\nexport function values(xs: number[]) { return xs.map(x => x*2).filter(x => x>2); }";
    const functions = read(source),
      outer = functions.find((f) => f.name === "values")!;
    const children = functionNesting(functions, outer.id).children;
    expect(children).toHaveLength(2);
    expect(children[0].name).toBe(children[1].name);
    expect(children[0].id).not.toBe(children[1].id);
    expect(children.map((f) => source.slice(f.start, f.end))).toEqual([
      "x => x*2",
      "x => x>2",
    ]);
    for (const child of children) {
      expect(child.label).toEqual({
        ko: "이름 없는 함수",
        en: "Anonymous function",
      });
      expect(child.line).toBe(2);
      expect(functionNesting(functions, child.id).parent?.id).toBe(outer.id);
    }
  });
  it("retains named expression labels and treats parameter callbacks as source nesting without inferring execution", () => {
    const functions = read(
      "function create(callback = () => 3) { return function named() { return callback(); }; }",
    );
    const outer = functions.find((f) => f.name === "create")!;
    const children = functionNesting(functions, outer.id).children;
    expect(children.map((f) => f.name)).toEqual(["function@1", "named"]);
    expect(children[1].label.en).not.toBe("Anonymous function");
    expect(outer.steps[0].text.en).toContain("separate function entry");
    expect(outer.steps[0].text.en).toContain(
      "calling code determines when it runs",
    );
  });
  it("does not treat adjacent or identical ranges as nesting and preserves input order", () => {
    const functions = read("function a(){} function b(){}");
    const original = structuredClone(functions);
    expect(functionNesting(functions, functions[0].id)).toEqual({
      parent: undefined,
      children: [],
    });
    const duplicate = { ...functions[0], id: "same-range" };
    expect(functionNesting([...functions, duplicate], functions[0].id)).toEqual(
      { parent: undefined, children: [] },
    );
    expect(functions).toEqual(original);
  });
});
