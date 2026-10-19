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
    expect(rows.map(({ execution, ...row }) => row)).toEqual([
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
    expect(
      observeFunction([arrow], arrow.path, target, "[[3]]")[0],
    ).toMatchObject({
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
  it("retains different executed branches and returns for each input, including expression-bodied arrows", () => {
    const f = {
      path: "branches.ts",
      content:
        "export const twice = (x: number) => x*2;\nexport function pick(x: number) {\n if (x <= 0) return 0;\n return twice(x);\n}",
    };
    const target = analyzeFile(f).functions.find((fn) => fn.name === "pick")!;
    const rows = observeFunction([f], f.path, target, "[[0],[3]]");
    expect(rows[0].execution).toEqual({
      steps: [
        { order: 1, line: 3, text: "x <= 0 → true" },
        { order: 2, line: 3, text: "결과 / return: 0" },
      ],
      omitted: false,
    });
    expect(rows[1].execution).toEqual({
      steps: [
        { order: 1, line: 3, text: "x <= 0 → false" },
        { order: 2, line: 1, text: "계산 / arithmetic: x*2\n3 * 2 → 6" },
        { order: 3, line: 1, text: "결과 / return: 6" },
        { order: 4, line: 4, text: "결과 / return: 6" },
      ],
      omitted: false,
    });
    expect(
      JSON.parse(
        assistantMessages({
          ...input,
          source: f.content,
          focus: target,
          observations: rows,
        })[1].content,
      ).calculationObservations.cases,
    ).toEqual(rows);
  });
  it("excludes imported source records and marks the gap without disclosing their paths or text", () => {
    const f = {
      path: "entry.ts",
      content:
        "import { hidden } from './secret';\nexport function f(){return hidden();}",
    };
    const other = {
      path: "secret.ts",
      content: "export function hidden(){if(1 < 2)return 9;return 0;}",
    };
    const target = analyzeFile(f).functions[0];
    const [row] = observeFunction([f, other], f.path, target, "[[]]");
    expect(row.execution).toEqual({
      steps: [{ order: 3, line: 2, text: "결과 / return: 9" }],
      omitted: true,
    });
    expect(JSON.stringify(row.execution)).not.toMatch(/secret|1 < 2/);
  });
  it("does not let recording an undisplayable intermediate closure change a returned calculation", () => {
    for (const make of [
      "() => (x: number) => x + 1",
      "() => { return (x: number) => x + 1; }",
    ]) {
      const f = {
        path: "closure.ts",
        content: `const make = ${make}; export function f(){ const next = make(); return next(2); }`,
      };
      const target = analyzeFile(f).functions.find((fn) => fn.name === "f")!;
      const [row] = observeFunction([f], f.path, target, "[[]]");
      expect(row.status, row.value).toBe("returned");
      expect(row.value).toBe("3");
      expect(row.execution?.omitted).toBe(true);
      expect(row.execution?.steps.at(-1)?.text).toBe("결과 / return: 3");
    }
  });
  it("shows omitted records honestly and keeps original indexes plus final observations in bounded traces", () => {
    const f = {
      path: "loop.ts",
      content:
        "export function f(){let x=0;while(x<30){if(x>=0)x++;}return x;}",
    };
    const [row] = observeFunction(
      [f],
      f.path,
      analyzeFile(f).functions[0],
      "[[]]",
    );
    expect(row.execution?.omitted).toBe(true);
    expect(row.execution?.steps.map((s) => s.order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 29, 30, 31, 32,
    ]);
    expect(row.execution?.steps.at(-1)?.text).toBe("결과 / return: 30");
    const huge = {
      path: "large.ts",
      content:
        'export function f(){if(true)return "' + "x".repeat(2100) + '";}',
    };
    const [long] = observeFunction(
      [huge],
      huge.path,
      analyzeFile(huge).functions[0],
      "[[]]",
    );
    expect(long.value.length).toBe(2102);
    expect(long.execution).toEqual({
      steps: [{ order: 1, line: 1, text: "true → true" }],
      omitted: true,
    });
  });
  it("rejects malformed, oversized and out-of-source execution records before a model request", () => {
    const step = { order: 1, line: 1, text: "x → true" };
    for (const execution of [
      null,
      { steps: [], omitted: "false" },
      { steps: [{ ...step, line: 99 }], omitted: false },
      { steps: [step, step], omitted: false },
      { steps: [{ ...step, text: "x".repeat(801) }], omitted: false },
      {
        steps: Array.from({ length: 13 }, (_, i) => ({
          ...step,
          order: i + 1,
        })),
        omitted: false,
      },
      {
        steps: Array.from({ length: 6 }, (_, i) => ({
          ...step,
          order: i + 1,
          text: "x".repeat(800),
        })),
        omitted: false,
      },
    ])
      expect(() =>
        validateAssistantInput({
          ...input,
          observations: [
            { args: "[]", status: "returned", value: "0", execution },
          ],
        } as AssistantInput),
      ).toThrow();
  });
});
