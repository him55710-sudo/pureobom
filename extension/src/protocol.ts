import type {
  FileAnalysis,
  ProjectAnalysis,
  Words,
} from "../../src/core/types";
export type ViewState = {
  contextId: string;
  path: string;
  language?: string;
  sourceBytes?: number;
  version: number;
  dirty: boolean;
  trusted: boolean;
  busy: boolean;
  analysis?: FileAnalysis;
  diagnostics?: import("../../src/core/editorDiagnostics").EditorDiagnostics;
  projectCheck?: import("./projectChecks").ProjectCheck;
  checkComparison?: import("./checkComparison").CheckComparison;
  benchmark?: import("./benchmarks").BenchmarkState;
  project?: ProjectAnalysis;
  scanNote?: string;
  error?: string;
  pythonNotice?: string;
  goNotice?: string;
  javaNotice?: string;
  csharpNotice?: string;
  rustNotice?: string;
  tab?: "story" | "map" | "local";
};
export type PatchSummary = {
  kind?: "function-format";
  reviewed?: boolean;
  id: string;
  description: Words;
  oldText: string;
  newText: string;
};
export type FormatSummary =
  | PatchSummary
  | { unchanged: true; description: Words };
// The controller binds this opaque handle to its latest calculation snapshot.
export type SimulationView = import("../../src/core/types").Simulation & {
  traceId: string;
};
export type Request = {
  id: string;
  action: string;
  contextId?: string;
  payload?: Record<string, unknown>;
};
export function requestMessage(value: unknown): Request {
  if (!value || typeof value !== "object") throw Error("잘못된 요청입니다.");
  const r = value as Record<string, unknown>;
  if (
    typeof r.id !== "string" ||
    r.id.length > 100 ||
    typeof r.action !== "string"
  )
    throw Error("잘못된 요청입니다.");
  if (r.contextId !== undefined && typeof r.contextId !== "string")
    throw Error("잘못된 문서 요청입니다.");
  if (
    r.payload !== undefined &&
    (!r.payload || typeof r.payload !== "object" || Array.isArray(r.payload))
  )
    throw Error("잘못된 입력입니다.");
  return r as Request;
}
export function inputString(value: unknown, max = 4096): string {
  if (typeof value !== "string" || value.length > max)
    throw Error("입력이 너무 길거나 올바르지 않습니다.");
  return value;
}
