import type { FunctionInfo, Patch, Rule, Simulation } from "./types";
export { displayValue } from "./previewValues";

export type Scenario = { label: string; args: unknown[] };
export type ScenarioResult = Scenario & {
  before: Simulation;
  after?: Simulation;
  status: "changed" | "same" | "unavailable" | "observed";
};
export type ScenarioReport = {
  path: string;
  name: string;
  change?: Patch["description"];
  rows: ScenarioResult[];
};

// Lightweight helpers shared by both UIs; never import the parser here.
export function suggestScenarios(
  fn: FunctionInfo,
  rules: Rule[],
  newValue?: string,
): Scenario[] {
  const base = fn.params.map((p) =>
    p.type === "boolean"
      ? false
      : p.type === "number"
        ? 0
        : p.type === "string"
          ? ""
          : null,
  );
  const numeric = fn.params.findIndex((p) => p.type === "number");
  if (numeric >= 0) {
    const boundary = rules.find(
      (r) =>
        r.type === "number" &&
        /threshold|limit|max|min|age|days/i.test(r.name) &&
        ["file", fn.name].includes(r.scope),
    );
    const value = boundary ? Number(boundary.value) : 1;
    const next = newValue === undefined ? NaN : Number(newValue);
    const step = Number.isInteger(value) ? 1 : 0.01;
    const values = [
      ...new Set([
        0,
        value - step,
        value,
        value + step,
        ...(Number.isFinite(next) && newValue?.trim()
          ? [next - step, next, next + step]
          : []),
      ]),
    ]
      .filter(Number.isFinite)
      .slice(0, 10);
    return values.map((v, i) => ({
      label: String(i + 1),
      args: base.map((b, n) => (n === numeric ? Number(v.toPrecision(12)) : b)),
    }));
  }
  const boolean = fn.params.findIndex((p) => p.type === "boolean");
  if (boolean >= 0)
    return [false, true].map((value, i) => ({
      label: String(i + 1),
      args: base.map((b, n) => (n === boolean ? value : b)),
    }));
  return [{ label: "1", args: base }];
}
