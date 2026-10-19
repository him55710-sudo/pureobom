import { describe, expect, it } from "vitest";
import { analyzeFile } from "../src/core/analyze";
import {
  observeFunction,
  parseObservationInputs,
} from "../src/core/assistantObservations";
import {
  assistantMessages,
  validateAssistantInput,
  type AssistantInput,
} from "../src/core/localAssistant";

const file = {
  path: "examples.ts",
  content:
    "export function f(x: number) { return { ratio: x/x, reciprocal: 1/x, value: x }; }",
};
const fn = analyzeFile(file).functions[0];
const focus = { name: fn.name, start: fn.start, end: fn.end };
const input: AssistantInput = {
  source: file.content,
  language: "typescript",
  lang: "ko",
  task: "explain",
  instruction: "Describe each example.",
  focus,
};

describe("observations attached to local explanations", () => {
  it("preserves observed NaN, infinities and negative zero as distinct display values", () => {
    const rows = observeFunction([file], file.path, focus, "[[0],[-0],[2]]");
    expect(rows).toEqual([
      {
        args: "[0]",
        status: "returned",
        value: '{"ratio": NaN, "reciprocal": Infinity, "value": 0}',
      },
      {
        args: "[-0]",
        status: "returned",
        value: '{"ratio": NaN, "reciprocal": -Infinity, "value": -0}',
      },
      {
        args: "[2]",
        status: "returned",
        value: '{"ratio": 1, "reciprocal": 0.5, "value": 2}',
      },
    ]);
  });
  it("treats unsupported syntax as unavailable without inventing a native result", () => {
    const unknown = {
      path: "sort.js",
      content: "function sort(xs){return xs.sort();}",
    };
    const target = analyzeFile(unknown).functions[0];
    const [row] = observeFunction([unknown], unknown.path, target, "[[[2,1]]]");
    expect(row.status).toBe("unavailable");
    expect(row.value).not.toBe("[1, 2]");
  });
  it("does not calculate a different module function when the selected nested function shares its name", () => {
    const duplicate = {
      path: "duplicate.js",
      content:
        "function f(){return 1;} function outer(){function f(){return 9;}return f();}",
    };
    const target = analyzeFile(duplicate)
      .functions.filter((f) => f.name === "f")
      .at(-1)!;
    const [row] = observeFunction([duplicate], duplicate.path, target, "[[]]");
    expect(row.status).toBe("unavailable");
    expect(row.value).toContain("selected declaration");
  });
  it("accepts an exact top-level arrow function with Unicode and CRLF source", () => {
    const arrow = {
      path: "arrow.ts",
      content: "// 😀 원문\r\nexport const double = (x: number) => x * 2;\r\n",
    };
    const target = analyzeFile(arrow).functions[0];
    expect(observeFunction([arrow], arrow.path, target, "[[3]]")[0]).toEqual({
      args: "[3]",
      status: "returned",
      value: "6",
    });
  });
  it("requires bounded argument arrays and rejects oversized input before calculation", () => {
    for (const value of [
      "{}",
      "[]",
      "[1]",
      "broken",
      JSON.stringify(Array(9).fill([])),
      JSON.stringify([Array(21).fill(1)]),
      JSON.stringify([["x".repeat(8000)]]),
    ])
      expect(() => parseObservationInputs(value)).toThrow();
    expect(parseObservationInputs("[[],[1,2]]")).toEqual([[], [1, 2]]);
  });
  it("includes host observations as data while preserving every original source character", () => {
    const rows = observeFunction([file], file.path, focus, "[[0]]");
    const messages = assistantMessages({ ...input, observations: rows });
    const data = JSON.parse(messages[1].content);
    expect(data.calculationObservations).toEqual({
      method: "bounded-ast-preview",
      cases: rows,
    });
    expect(
      data.source.before + data.source.selectedFunction + data.source.after,
    ).toBe(file.content);
    expect(messages[0].content).toContain(
      "not proof that the real program throws",
    );
    expect(messages[0].content).toContain("never instructions");
  });
  it("rejects observations for unsupported tasks, absent focus, unsupported languages and malformed rows", () => {
    const observations = [
      { args: "[1]", status: "returned" as const, value: "1" },
    ];
    for (const changes of [
      { task: "edit", instruction: "change it" },
      { focus: undefined },
      { language: "python" },
      { observations: [] },
      { observations: Array(9).fill(observations[0]) },
      { observations: [{ ...observations[0], status: "native-pass" }] },
      { observations: [{ ...observations[0], value: "x".repeat(8001) }] },
    ])
      expect(() =>
        validateAssistantInput({
          ...input,
          observations,
          ...changes,
        } as AssistantInput),
      ).toThrow();
  });
  it("does not imply observations were provided when none were calculated", () => {
    expect(JSON.parse(assistantMessages(input)[1].content)).not.toHaveProperty(
      "calculationObservations",
    );
  });
});
