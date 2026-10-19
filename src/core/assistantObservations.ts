import type { AssistantFocus, AssistantObservation } from "./localAssistant";
import { assistantExecutionLimits } from "./localAssistant";
import type { SourceFile } from "./types";
import { simulate } from "./simulate";
import { displayValue } from "./previewValues";

export function parseObservationInputs(input: string): unknown[][] {
  if (
    typeof input !== "string" ||
    new TextEncoder().encode(input).byteLength > 8000
  )
    throw Error(
      "예시 입력은 8KB까지입니다. / Example inputs are limited to 8KB.",
    );
  let values: unknown;
  try {
    values = JSON.parse(input);
  } catch {
    throw Error(
      "예시마다 인수를 배열로 묶어 주세요. 예: [[0], [5]] / Use an array of argument arrays, such as [[0], [5]].",
    );
  }
  if (
    !Array.isArray(values) ||
    values.length < 1 ||
    values.length > 8 ||
    values.some((args) => !Array.isArray(args) || args.length > 20)
  )
    throw Error(
      "1~8개 예시를 입력하세요. 각 예시는 인수 20개 이하의 배열입니다. / Provide 1–8 examples, each an array of up to 20 arguments.",
    );
  return values;
}

export function observeFunction(
  files: SourceFile[],
  path: string,
  focus: AssistantFocus,
  input: string,
): AssistantObservation[] {
  if (
    !focus ||
    typeof focus.name !== "string" ||
    !Number.isInteger(focus.start) ||
    !Number.isInteger(focus.end) ||
    focus.start < 0 ||
    focus.end <= focus.start
  )
    throw Error("설명할 기능을 선택하세요. / Select an explanation focus.");
  return parseObservationInputs(input).map((args) => {
    const result = simulate(files, path, focus.name, args, focus);
    const value = result.ok
      ? displayValue(result.result)
      : result.error || "Unavailable";
    const shownArgs = displayValue(args);
    if (value.length > 8000 || shownArgs.length > 8000)
      throw Error(
        "계산 예시가 너무 큽니다. 더 작은 입력을 사용하세요. / Observation too large. Use smaller examples.",
      );
    return {
      args: shownArgs,
      status: result.ok ? "returned" : "unavailable",
      value,
      execution: executionRecords(result.trace, path),
    };
  });
}

function executionRecords(trace: import("./types").Trace[], path: string) {
  let omitted = false;
  const eligible = trace.flatMap((step, index) => {
    if (
      step.path !== path ||
      step.truncated ||
      step.text.length > assistantExecutionLimits.stepCharacters
    ) {
      omitted = true;
      return [];
    }
    return [{ order: index + 1, line: step.line, text: step.text }];
  });
  // Keep both early decisions and final observations, with original indexes showing gaps.
  const selected =
    eligible.length > assistantExecutionLimits.steps
      ? [...eligible.slice(0, 8), ...eligible.slice(-4)]
      : eligible;
  if (selected.length !== eligible.length) omitted = true;
  let characters = 0;
  const steps = selected.filter((step) => {
    if (characters + step.text.length > assistantExecutionLimits.characters) {
      omitted = true;
      return false;
    }
    characters += step.text.length;
    return true;
  });
  return { steps, omitted };
}
