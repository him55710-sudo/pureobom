import { describe, expect, it } from "vitest";
import {
  assistantContextSize,
  assistantLanguages,
  assistantMessages,
  assistantResponseSchema,
  assistantSchema,
  parseAssistantProposal,
  type AssistantInput,
} from "../src/core/localAssistant";

const source = "function divide(x) { return 10 / x; }";
const input: AssistantInput = {
  source,
  language: "javascript",
  task: "explain",
  lang: "en",
  instruction: "Explain the cases and input requirements.",
  focus: { name: "divide", start: 0, end: source.length },
  observations: [
    { args: "[2]", status: "returned", value: "5" },
    { args: "[0]", status: "returned", value: "Infinity" },
  ],
};
const answer = () => ({
  summary: "Divides ten by the argument.",
  citations: [
    {
      quote: "return 10 / x;",
      explanation: "The result of division is returned.",
    },
  ],
  inputChecks: "There is no input validation.",
  callerRequirements:
    "Ordinary finite division requires a numeric nonzero divisor; this is not checked.",
  examples: [
    { case: 1, citation: 1, explanation: "Ten divided by two returns five." },
    {
      case: 2,
      citation: 1,
      explanation:
        "Numeric division by positive zero returns positive infinity.",
    },
  ],
});
const parse = (data: unknown, request = input) =>
  parseAssistantProposal(JSON.stringify(data), request);

describe("structured explanation coverage", () => {
  it("uses an explanation-only contract for all supported languages and preserves the editing contract", () => {
    for (const language of Object.keys(assistantLanguages)) {
      const request = {
        ...input,
        language,
        focus: undefined,
        observations: undefined,
      };
      const schema = assistantResponseSchema(request);
      expect(schema.required).toEqual([
        "summary",
        "citations",
        "inputChecks",
        "callerRequirements",
        "examples",
      ]);
      expect(schema.properties).not.toHaveProperty("edits");
      expect(schema.properties).toHaveProperty("examples.maxItems", 0);
      expect(
        parse({ ...answer(), examples: [] }, request).explanation?.examples,
      ).toEqual([]);
    }
    expect(
      assistantResponseSchema({
        ...input,
        task: "edit",
        focus: undefined,
        observations: undefined,
      }),
    ).toBe(assistantSchema);
  });
  it("preserves source and returns an ordered explanation for every observation without any edit", () => {
    const data = answer();
    data.examples.reverse();
    const result = parse(data);
    expect(result.updated).toBe(source);
    expect(result.edits).toEqual([]);
    expect(result.checks).toEqual([]);
    expect(result.explanation?.examples.map((e) => e.case)).toEqual([1, 2]);
    expect(result.explanation?.inputChecks).toBe(data.inputChecks);
    expect(result.explanation?.callerRequirements).toBe(
      data.callerRequirements,
    );
  });
  it("rejects missing or duplicated cases and invalid source references", () => {
    const data = answer();
    for (const examples of [
      [],
      data.examples.slice(0, 1),
      [data.examples[0], data.examples[0]],
    ])
      expect(() => parse({ ...data, examples })).toThrow(
        /every supplied example/,
      );
    for (const field of ["case", "citation"] as const)
      for (const value of [0, -1, 0.5, "1", 7, null])
        expect(() =>
          parse({
            ...data,
            examples: [
              { ...data.examples[0], [field]: value },
              data.examples[1],
            ],
          }),
        ).toThrow(/reference/);
    expect(() => parse(data, { ...input, observations: undefined })).toThrow(
      /reference/,
    );
  });
  it("rejects edits, absent sections, empty prose and model-supplied replacement observation values", () => {
    const data = answer();
    expect(() => parse({ ...data, edits: [] })).toThrow(/structure/);
    const { inputChecks: _, ...missing } = data;
    expect(() => parse(missing)).toThrow(/structure/);
    expect(() => parse({ ...data, callerRequirements: " " })).toThrow(/text/);
    expect(() =>
      parse({
        ...data,
        examples: [{ ...data.examples[0], value: "forged" }, data.examples[1]],
      }),
    ).toThrow(/structure/);
    expect(() =>
      parse({
        ...data,
        examples: [{ ...data.examples[0], explanation: "" }, data.examples[1]],
      }),
    ).toThrow(/text/);
  });
  it("applies the existing Korean language guard to all new prose fields", () => {
    const data = {
      summary: "나눗셈 결과입니다.",
      citations: [
        { quote: "return 10 / x;", explanation: "나눈 값을 반환합니다." },
      ],
      inputChecks: "입력 검사는 없습니다.",
      callerRequirements: "일반적인 나눗셈에는 숫자를 전달해야 합니다.",
      examples: answer().examples.map((e) => ({
        ...e,
        explanation: "이 예시의 나눗셈 결과를 설명합니다.",
      })),
    };
    expect(
      parse(data, { ...input, lang: "ko" }).explanation?.examples,
    ).toHaveLength(2);
    for (const field of ["inputChecks", "callerRequirements"])
      expect(() =>
        parse({ ...data, [field]: "English only" }, { ...input, lang: "ko" }),
      ).toThrow(/Korean response/);
    expect(() =>
      parse({ ...data, examples: answer().examples }, { ...input, lang: "ko" }),
    ).toThrow(/Korean response/);
  });
  it("budgets the actual task schema and treats case coverage separately from truth", () => {
    const messages = assistantMessages(input),
      format = assistantResponseSchema(input);
    const needed =
      new TextEncoder().encode(JSON.stringify({ messages, format }))
        .byteLength +
      4096 +
      1024;
    expect(assistantContextSize(messages, format)).toBeGreaterThanOrEqual(
      needed,
    );
    const data = answer();
    data.examples[0].explanation =
      "An incorrect claim is still model prose, not a verified fact.";
    expect(parse(data).explanation?.examples[0].explanation).toBe(
      data.examples[0].explanation,
    );
    expect(
      JSON.parse(messages[1].content).calculationObservations.cases,
    ).toEqual(input.observations);
  });
});
