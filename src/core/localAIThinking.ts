import type { Words } from "./types";

export type ThinkingValue = boolean | string;
export type ThinkingMetadata = {
  values: ThinkingValue[];
  default?: ThinkingValue;
};
export type ThinkingRequest = {
  requested: ThinkingValue | null;
  modelDefault?: ThinkingValue;
};

function isThinkingValue(value: unknown): value is ThinkingValue {
  return (
    typeof value === "boolean" ||
    (typeof value === "string" &&
      value.length > 0 &&
      value.length <= 80 &&
      value.trim() === value &&
      !/[\u0000-\u001f\u007f]/.test(value))
  );
}

/** null leaves the model's default unchanged. Explicit values need a fresh capability check. */
export function thinkingSelection(value: unknown = null): ThinkingValue | null {
  if (value === null || isThinkingValue(value)) return value;
  throw Error(
    "추론 설정을 다시 선택하세요. / Select a valid thinking setting.",
  );
}

export function thinkingMetadata(raw: unknown): ThinkingMetadata {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return { values: [] };
  const data = raw as Record<string, unknown>;
  const values = Array.isArray(data.values)
    ? [...new Set(data.values.filter(isThinkingValue))].slice(0, 32)
    : [];
  return {
    values,
    ...(isThinkingValue(data.default) && values.includes(data.default)
      ? { default: data.default }
      : {}),
  };
}

export function thinkingRequest(
  requested: ThinkingValue | null,
  metadata: ThinkingMetadata,
): ThinkingRequest {
  if (requested !== null && !metadata.values.includes(requested))
    throw Error(
      "이 모델이 지원하는 추론 설정을 다시 확인하세요. / Refresh the model's supported thinking settings.",
    );
  return {
    requested,
    ...(metadata.default !== undefined
      ? { modelDefault: metadata.default }
      : {}),
  };
}

export function thinkingLabel(value: ThinkingValue | null): Words {
  if (value === null) return { ko: "모델 기본값", en: "Model default" };
  if (value === true) return { ko: "켜짐", en: "On" };
  if (value === false) return { ko: "꺼짐", en: "Off" };
  return { ko: `수준: ${value}`, en: `Level: ${value}` };
}
