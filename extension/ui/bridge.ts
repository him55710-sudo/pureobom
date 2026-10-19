import {
  decodePreviewMessage,
  encodePreviewMessage,
  usesPreviewTransport,
} from "../../src/core/previewValues";
import {
  isLocalAIPhase,
  localAITimeoutSeconds,
  type LocalAIProgress,
} from "../../src/core/localAIProgress";
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(value: unknown): void;
};
export const host = acquireVsCodeApi();
let sequence = 0;
const pending = new Map<
  string,
  {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
    preview: boolean;
    onProgress?: LocalAIProgress;
  }
>();
window.addEventListener("message", (e) => {
  if (e.data?.type === "progress") {
    const request = pending.get(e.data.id);
    if (request && isLocalAIPhase(e.data.phase))
      request.onProgress?.(e.data.phase);
    return;
  }
  if (e.data?.type !== "response") return;
  const request = pending.get(e.data.id);
  if (!request) return;
  clearTimeout(request.timer);
  pending.delete(e.data.id);
  if (e.data.error) request.reject(Error(e.data.error));
  else {
    try {
      request.resolve(
        request.preview ? decodePreviewMessage(e.data.result) : e.data.result,
      );
    } catch (error) {
      request.reject(error instanceof Error ? error : Error(String(error)));
    }
  }
});
export function request<T = void>(
  action: string,
  payload?: Record<string, unknown>,
  contextId?: string,
  onProgress?: LocalAIProgress,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const preview = usesPreviewTransport(action);
    const wirePayload = preview ? encodePreviewMessage(payload || {}) : payload;
    const id = String(++sequence);
    const timer = setTimeout(
      () => {
        pending.delete(id);
        reject(
          Error(
            "응답이 없습니다. 설명을 다시 열어 주세요. / No response; reopen the explanation.",
          ),
        );
      },
      action === "localGenerate"
        ? localAITimeoutSeconds(payload?.timeoutSeconds) * 1000 + 60000
        : 60000,
    );
    pending.set(id, { resolve, reject, timer, preview, onProgress });
    host.postMessage({ id, action, payload: wirePayload, contextId });
  });
}
