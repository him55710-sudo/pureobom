import type { ProjectCheck } from "./projectChecks";

export type CheckRecord = { check: ProjectCheck; identity: string };
export type CheckComparison = {
  baseline?: ProjectCheck;
  outcome:
    | "no-baseline"
    | "awaiting-run"
    | "incomplete"
    | "stale"
    | "different-command"
    | "passed-to-failed"
    | "failed-to-passed"
    | "both-passed"
    | "both-failed";
  sourceChanged?: boolean;
};

export function completedCheck(check: ProjectCheck): boolean {
  return (
    Number.isInteger(check.exitCode) &&
    ((check.status === "passed" && check.exitCode === 0) ||
      (check.status === "failed" && check.exitCode !== 0))
  );
}

/** Compares recorded command outcomes; never infers equivalent behavior. */
export function compareChecks(
  baseline: CheckRecord | undefined,
  current: CheckRecord | undefined,
): CheckComparison {
  if (!baseline) return { outcome: "no-baseline" };
  const view = { baseline: { ...baseline.check } };
  if (!current || current.check.id === baseline.check.id)
    return { ...view, outcome: "awaiting-run" };
  if (baseline.identity !== current.identity)
    return { ...view, outcome: "different-command" };
  if (current.check.stale) return { ...view, outcome: "stale" };
  if (!completedCheck(baseline.check) || !completedCheck(current.check))
    return { ...view, outcome: "incomplete" };
  return {
    ...view,
    sourceChanged: baseline.check.sourceSha256 !== current.check.sourceSha256,
    outcome:
      baseline.check.status === "passed"
        ? current.check.status === "passed"
          ? "both-passed"
          : "passed-to-failed"
        : current.check.status === "passed"
          ? "failed-to-passed"
          : "both-failed",
  };
}
