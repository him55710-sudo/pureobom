import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

let receive: (event: { data: unknown }) => void;
let sent: { id: string }[];
beforeEach(() => {
  vi.resetModules();
  sent = [];
  vi.stubGlobal("window", {
    addEventListener: (_: string, callback: typeof receive) => {
      receive = callback;
    },
  });
  vi.stubGlobal("acquireVsCodeApi", () => ({
    postMessage: (message: { id: string }) => sent.push(message),
  }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("request-scoped local AI progress", () => {
  it("routes only known phases for the matching pending request and ignores late events", async () => {
    const { request } = await import("../extension/ui/bridge");
    const progress = vi.fn(),
      other = vi.fn();
    const first = request("localGenerate", {}, "one", progress);
    const second = request("localGenerate", {}, "two", other);
    receive({
      data: { type: "progress", id: sent[0].id, phase: "generation" },
    });
    receive({
      data: { type: "progress", id: sent[1].id, phase: "connection" },
    });
    receive({ data: { type: "progress", id: sent[0].id, phase: "__proto__" } });
    receive({ data: { type: "progress", id: "unknown", phase: "validation" } });
    expect(progress.mock.calls).toEqual([["generation"]]);
    expect(other.mock.calls).toEqual([["connection"]]);
    receive({ data: { type: "response", id: sent[0].id, result: "done" } });
    expect(await first).toBe("done");
    receive({
      data: { type: "progress", id: sent[0].id, phase: "validation" },
    });
    expect(progress).toHaveBeenCalledTimes(1);
    receive({ data: { type: "response", id: sent[1].id, result: "other" } });
    await second;
  });
  it("clears progress callbacks when a request fails or exceeds the bridge deadline", async () => {
    vi.useFakeTimers();
    const { request } = await import("../extension/ui/bridge");
    const progress = vi.fn();
    const failed = request("localGenerate", {}, "one", progress);
    const rejected = expect(failed).rejects.toThrow("offline");
    receive({ data: { type: "response", id: sent[0].id, error: "offline" } });
    await rejected;
    const waiting = request("localGenerate", {}, "two", progress);
    const timeout = expect(waiting).rejects.toThrow(/No response/);
    await vi.advanceTimersByTimeAsync(240000);
    await timeout;
    for (const { id } of sent)
      receive({ data: { type: "progress", id, phase: "generation" } });
    expect(progress).not.toHaveBeenCalled();
  });
  it("honors the selected longer wait without losing progress and rejects unsupported limits", async () => {
    vi.useFakeTimers();
    const { request } = await import("../extension/ui/bridge");
    const progress = vi.fn();
    for (const bad of [0, 30, 10000, 180.5, "300", null])
      await expect(
        request("localGenerate", { timeoutSeconds: bad }),
      ).rejects.toThrow(/time limit/);
    expect(sent).toHaveLength(0);
    const waiting = request(
      "localGenerate",
      { timeoutSeconds: 300 },
      "one",
      progress,
    );
    const expired = expect(waiting).rejects.toThrow(/No response/);
    await vi.advanceTimersByTimeAsync(240000);
    receive({
      data: { type: "progress", id: sent[0].id, phase: "generation" },
    });
    expect(progress).toHaveBeenCalledWith("generation");
    await vi.advanceTimersByTimeAsync(120000);
    await expired;
  });
});
