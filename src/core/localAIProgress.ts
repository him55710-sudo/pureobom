import type { Words } from "./types";

export const localAIPhases = {
  connection: {
    ko: "Ollama 연결·로컬 전용 설정 확인",
    en: "Checking Ollama connection and local-only mode",
  },
  models: { ko: "설치 모델 목록 확인", en: "Reading installed models" },
  model: { ko: "선택한 모델 정보 확인", en: "Checking the selected model" },
  generation: { ko: "로컬 모델 답변 생성", en: "Generating a local response" },
  validation: {
    ko: "답변의 원문 근거·변경안 검사",
    en: "Checking source evidence and proposed changes",
  },
} satisfies Record<string, Words>;

export type LocalAIPhase = keyof typeof localAIPhases;
export function isLocalAIPhase(value: unknown): value is LocalAIPhase {
  return typeof value === "string" && Object.hasOwn(localAIPhases, value);
}
export type LocalAIProgress = (phase: LocalAIPhase) => void;

export const localAITimeoutChoices = [180, 300, 600] as const;
export function localAITimeoutSeconds(value: unknown = 180): number {
  if (
    typeof value !== "number" ||
    !localAITimeoutChoices.some((choice) => choice === value)
  )
    throw Error(
      "답변 대기 한도는 3·5·10분 중 선택하세요. / Choose a response time limit of 3, 5 or 10 minutes.",
    );
  return value;
}
