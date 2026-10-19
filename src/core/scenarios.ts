import { simulate } from "./simulate";
import type { Patch, SourceFile } from "./types";
import type { Scenario, ScenarioReport } from "./scenarioModel";

// Type tags preserve undefined, NaN and negative zero without confusing them
// with real strings or null. Object key order is not a behavior change.
function fingerprint(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value))
    return `array:[${Array.from({ length: value.length }, (_, index) =>
      Object.hasOwn(value, index) ? fingerprint(value[index]) : "empty",
    ).join(",")}]`;
  if (typeof value === "object")
    return `object:{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${fingerprint(v)}`)
      .join(",")}}`;
  if (typeof value === "number" && Object.is(value, -0)) return "number:-0";
  return `${typeof value}:${JSON.stringify(value) ?? String(value)}:${typeof value === "number" ? String(value) : ""}`;
}

export function compareScenarios(
  files: SourceFile[],
  path: string,
  name: string,
  scenarios: Scenario[],
  patch?: Patch,
): ScenarioReport {
  if (
    !Array.isArray(scenarios) ||
    scenarios.length < 1 ||
    scenarios.length > 12
  )
    throw Error("Use 1–12 scenarios. / 입력 사례는 1~12개까지 가능합니다.");
  if (JSON.stringify(scenarios).length > 24000)
    throw Error("Scenario inputs are too large. / 입력이 너무 큽니다.");
  for (const row of scenarios) {
    if (
      !row ||
      typeof row.label !== "string" ||
      row.label.length > 100 ||
      !Array.isArray(row.args) ||
      row.args.length > 20
    )
      throw Error("Invalid scenario. / 입력 사례가 올바르지 않습니다.");
  }
  if (
    patch &&
    files.find((f) => f.path === patch.path)?.content !== patch.original
  )
    throw Error(
      "The source changed. Create a new preview. / 원본이 바뀌었습니다. 변경안을 다시 만드세요.",
    );
  const updated = patch
    ? files.map((f) =>
        f.path === patch.path ? { ...f, content: patch.updated } : f,
      )
    : undefined;
  return {
    path,
    name,
    change: patch?.description,
    rows: scenarios.map((row) => {
      const before = simulate(files, path, name, row.args);
      const after = updated
        ? simulate(updated, path, name, row.args)
        : undefined;
      const status =
        !before.ok || (after && !after.ok)
          ? "unavailable"
          : !after
            ? "observed"
            : fingerprint(before.result) === fingerprint(after.result)
              ? "same"
              : "changed";
      return { ...row, before, after, status };
    }),
  };
}
