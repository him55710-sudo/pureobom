import { describe, expect, it } from "vitest";
import {
  compareChecks,
  type CheckRecord,
} from "../extension/src/checkComparison";

function record(
  id: string,
  status: "passed" | "failed" = "passed",
): CheckRecord {
  return {
    identity: "same-command-settings-manifest-file",
    check: {
      id,
      name: "check",
      folder: "fixture",
      file: "value.ts",
      sourceSha256: id,
      startedAt: "2026-01-01T00:00:00Z",
      status,
      exitCode: status === "passed" ? 0 : 1,
      stale: false,
    },
  };
}
describe("recorded project check comparisons", () => {
  it("waits for a distinct result and returns an independent historical snapshot", () => {
    const before = record("before");
    expect(compareChecks(undefined, before).outcome).toBe("no-baseline");
    expect(compareChecks(before, undefined).outcome).toBe("awaiting-run");
    const view = compareChecks(before, before);
    expect(view.outcome).toBe("awaiting-run");
    view.baseline!.sourceSha256 = "mutated";
    expect(before.check.sourceSha256).toBe("before");
  });
  it.each([
    ["passed", "failed", "passed-to-failed"],
    ["failed", "passed", "failed-to-passed"],
    ["passed", "passed", "both-passed"],
    ["failed", "failed", "both-failed"],
  ] as const)("compares %s to %s as %s", (a, b, outcome) => {
    const result = compareChecks(record("before", a), record("after", b));
    expect(result.outcome).toBe(outcome);
    expect(result.sourceChanged).toBe(true);
    const after = record("after", b);
    after.check.sourceSha256 = "before";
    expect(compareChecks(record("before", a), after).sourceChanged).toBe(false);
  });
  it.each(["running", "stopping", "cancelled", "timeout", "unknown"] as const)(
    "does not compare %s as a completed result",
    (status) => {
      const after = record("after");
      after.check.status = status;
      expect(compareChecks(record("before"), after).outcome).toBe("incomplete");
    },
  );
  it("rejects stale evidence, changed identities and missing or inconsistent exits", () => {
    const before = record("before"),
      after = record("after");
    after.check.stale = true;
    expect(compareChecks(before, after).outcome).toBe("stale");
    after.check.stale = false;
    after.identity = "different-file-or-command";
    expect(compareChecks(before, after).outcome).toBe("different-command");
    after.identity = before.identity;
    for (const exit of [undefined, NaN, 0.5, 1]) {
      after.check.exitCode = exit;
      expect(compareChecks(before, after).outcome).toBe("incomplete");
    }
  });
});
