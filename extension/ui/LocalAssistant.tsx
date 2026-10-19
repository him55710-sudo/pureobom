import { useEffect, useRef, useState } from "react";
import type { Lang, Words } from "../../src/core/types";
import {
  assistantLanguages,
  assistantLimits,
  supportsWhitespaceConstraint,
  supportsObservationInputs,
  type AssistantTask,
} from "../../src/core/localAssistant";
import type {
  AssistantResult,
  ObservationView,
} from "../src/localAssistantController";
import type { InferenceProcessor, LocalModel } from "../src/ollama";
import type { ViewState } from "../src/protocol";
import { request } from "./bridge";
import "./local-assistant.css";
import {
  localAIPhases,
  localAITimeoutChoices,
  type LocalAIPhase,
} from "../../src/core/localAIProgress";

export function LocalAssistant({
  state,
  lang,
  initialFocus,
}: {
  state: ViewState;
  lang: Lang;
  initialFocus?: { context: string; id: string };
}) {
  const [models, setModels] = useState<LocalModel[]>([]);
  const [model, setModel] = useState("");
  const [processor, setProcessor] = useState<InferenceProcessor>("auto");
  const [timeoutSeconds, setTimeoutSeconds] = useState(180);
  const [origin, setOrigin] = useState("");
  const [task, setTask] = useState<AssistantTask>("explain");
  const [focusChoice, setFocusChoice] = useState(initialFocus);
  const focusedFunction =
    task === "explain" && focusChoice?.context === state.contextId
      ? state.analysis?.functions.find((f) => f.id === focusChoice.id)
      : undefined;
  const [whitespaceOnly, setWhitespaceOnly] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [exampleInputs, setExampleInputs] = useState("");
  const [observed, setObserved] = useState<{
    context: string;
    focusId: string;
    inputs: string;
    result: ObservationView;
  }>();
  const observation =
    observed?.context === state.contextId &&
    observed.focusId === focusedFunction?.id &&
    observed.inputs === exampleInputs
      ? observed.result
      : undefined;
  const [busy, setBusy] = useState(false);
  const [generationStarted, setGenerationStarted] = useState<number>();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [progress, setProgress] = useState<{
    context: string;
    phase: LocalAIPhase;
  }>();
  const phase =
    progress?.context === state.contextId ? progress.phase : undefined;
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Words>();
  const [generated, setGenerated] = useState<{
    context: string;
    lang: Lang;
    result: AssistantResult;
  }>();
  const [reviewed, setReviewed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const mounted = useRef(true),
    operation = useRef(false),
    output = useRef<HTMLElement>(null);
  const activeContext = useRef(state.contextId);
  activeContext.current = state.contextId;
  const activeLanguage = useRef(lang);
  activeLanguage.current = lang;
  const result =
    generated?.context === state.contextId && generated.lang === lang
      ? generated.result
      : undefined;
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(
    () => () => {
      void request("localCancel").catch(() => {});
    },
    [lang],
  );
  useEffect(() => {
    if (result) output.current?.focus();
  }, [result]);
  useEffect(() => {
    if (generationStarted === undefined) return;
    const timer = window.setInterval(
      () =>
        setElapsedSeconds(Math.floor((Date.now() - generationStarted) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [generationStarted]);
  async function run(job: () => Promise<void>, generating = false) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    setNotice(undefined);
    if (generating) {
      setProgress(undefined);
      setElapsedSeconds(0);
      setGenerationStarted(Date.now());
    }
    const context = state.contextId;
    try {
      await job();
    } catch (e) {
      if (
        mounted.current &&
        activeContext.current === context &&
        activeLanguage.current === lang
      )
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      operation.current = false;
      if (mounted.current) {
        setBusy(false);
        setGenerationStarted(undefined);
        setProgress(undefined);
      }
    }
  }
  const eligible =
    state.trusted &&
    !state.busy &&
    !!state.language &&
    Object.hasOwn(assistantLanguages, state.language) &&
    (state.sourceBytes ?? Infinity) <= assistantLimits.sourceBytes;
  const canConstrainWhitespace =
    task === "edit" && supportsWhitespaceConstraint(state.language || "");
  const canObserve =
    !!focusedFunction && supportsObservationInputs(state.language || "");
  function clearProposal() {
    setGenerated(undefined);
    setReviewed(false);
    setAcknowledged(false);
  }
  return (
    <section className="local-assistant">
      <div className="card">
        <h2>
          {t("내 PC의 AI로 읽고 고치기", "Read and change with local AI")}
        </h2>
        <p>
          {t(
            "현재 파일과 요청, 선택한 예시 계산 결과를 로컬 모델로 보냅니다. 모델의 추론은 틀릴 수 있어 원문 근거와 계산 결과·변경안을 함께 확인합니다.",
            "The current file, your request and any selected calculation examples go to the local model. Review source evidence, observed results and changes because model reasoning can be wrong.",
          )}
        </p>
        <p className="muted">
          {state.path} ·{" "}
          {assistantLanguages[state.language || ""] || state.language} ·{" "}
          {state.sourceBytes ?? 0} bytes / 24,000
        </p>
        <details className="local-setup">
          <summary>
            {t("처음 사용: Ollama 준비하기", "First use: prepare Ollama")}
          </summary>
          <p>
            {t(
              "Ollama와 원하는 로컬 코드 모델을 설치하세요. 설치·모델 다운로드에는 인터넷과 저장 공간이 필요합니다. 로컬 추론에는 API 키가 필요 없으며, 속도는 PC와 모델에 따라 달라집니다.",
              "Install Ollama and a local code model. Installation and model downloads need internet and storage. Local inference needs no API key; speed depends on your PC and model.",
            )}
          </p>
          <p>
            {t(
              "실행 중인 Ollama를 종료한 뒤, 터미널에서 클라우드 기능을 끄고 시작하세요.",
              "Quit any running Ollama server, then start with cloud features disabled.",
            )}
          </p>
          <pre>{`# Windows PowerShell\n$env:OLLAMA_NO_CLOUD="1"\nollama serve\n\n# macOS / Linux\nOLLAMA_NO_CLOUD=1 ollama serve`}</pre>
          <p>
            {t(
              "다른 터미널에서 예시 모델을 내려받을 수 있습니다. 모델별 라이선스를 확인하세요.",
              "You can download an example model in another terminal. Check the model's license.",
            )}
          </p>
          <pre>ollama pull qwen2.5-coder:3b</pre>
          <p>
            {t(
              "별도 포트는 VS Code의 Pureobom: Ollama Port 설정에서 지정합니다. 원격 VS Code 연결은 아직 지원하지 않습니다. 모델 설치나 설정 변경을 자동 실행하지 않습니다.",
              "Set a custom port in VS Code's Pureobom: Ollama Port setting. Remote VS Code is not supported yet. This panel does not install models or change server settings automatically.",
            )}
          </p>
        </details>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              clearProposal();
              const next = await request<{
                origin: string;
                models: LocalModel[];
              }>("localModels");
              if (!mounted.current) return;
              setModels(next.models);
              setOrigin(next.origin);
              setModel(next.models[0]?.name || "");
              setNotice(
                next.models.length
                  ? {
                      ko: "로컬 전용 설정을 확인했습니다.",
                      en: "Local-only mode confirmed.",
                    }
                  : {
                      ko: "설치된 로컬 텍스트 모델이 없습니다.",
                      en: "No installed local text model found.",
                    },
              );
            })
          }
        >
          {t("Ollama 연결 확인", "Connect to Ollama")}
        </button>
        {origin ? <p className="muted">{origin}</p> : null}
        {models.length ? (
          <label>
            {t("사용할 로컬 모델", "Local model")}
            <select
              value={model}
              disabled={busy}
              onChange={(e) => {
                setModel(e.target.value);
                clearProposal();
              }}
            >
              {models.map((m) => (
                <option key={m.digest + m.name} value={m.name}>
                  {m.name} · {(m.size / 1e9).toFixed(1)} GB
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          {t("연산 장치", "Processor")}
          <select
            value={processor}
            aria-label={t("연산 장치", "Processor")}
            aria-describedby="local-processor-description"
            disabled={busy}
            onChange={(event) => {
              setProcessor(event.target.value as InferenceProcessor);
              clearProposal();
            }}
          >
            <option value="auto">
              {t("Ollama 자동 선택", "Ollama automatic")}
            </option>
            <option value="cpu">{t("CPU 사용 요청", "Request CPU")}</option>
          </select>
          <span className="muted" id="local-processor-description">
            {t(
              "응답이 느리면 CPU 요청과 비교해 보세요. 이 요청의 실행 옵션이며, 속도는 PC와 모델에 따라 다릅니다.",
              "If responses are slow, compare a CPU request. This is an option for this request; speed depends on your PC and model.",
            )}
          </span>
        </label>
        <label>
          {t("답변 생성 대기 한도", "Response time limit")}
          <select
            value={timeoutSeconds}
            disabled={busy}
            onChange={(event) => {
              setTimeoutSeconds(Number(event.target.value));
              clearProposal();
            }}
          >
            {localAITimeoutChoices.map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds / 60}
                {t("분", " minutes")}
                {seconds === 180 ? t(" (기본)", " (default)") : ""}
              </option>
            ))}
          </select>
          <span className="muted">
            {t(
              "느린 PC에서는 대기 시간을 늘릴 수 있습니다. 연결 확인 시간은 별도이며, 기다리는 동안 취소할 수 있습니다.",
              "Allow more time on a slow PC. Connection checks have separate limits; you can cancel while waiting.",
            )}
          </span>
        </label>
        <label>
          {t("하고 싶은 작업", "Task")}
          <select
            value={task}
            disabled={busy}
            onChange={(e) => {
              setTask(e.target.value as AssistantTask);
              setObserved(undefined);
              clearProposal();
            }}
          >
            <option value="explain">
              {t("쉬운 말로 설명", "Explain in plain language")}
            </option>
            <option value="edit">
              {t("요청한 내용으로 수정 제안", "Propose a requested change")}
            </option>
            <option value="optimize">
              {t("최적화 제안과 확인할 점", "Suggest optimization and checks")}
            </option>
          </select>
        </label>
        {task === "explain" && !!state.analysis?.functions.length && (
          <label>
            {t("설명할 범위", "Explanation focus")}
            <select
              value={focusedFunction?.id || ""}
              aria-label={t("설명할 범위", "Explanation focus")}
              aria-describedby={
                focusedFunction ? "local-focus-description" : undefined
              }
              disabled={busy || state.busy}
              onChange={(event) => {
                setFocusChoice({
                  context: state.contextId,
                  id: event.target.value,
                });
                setObserved(undefined);
                clearProposal();
              }}
            >
              <option value="">{t("현재 파일", "Current file")}</option>
              {state.analysis.functions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} · L{f.line}
                </option>
              ))}
            </select>
            {focusedFunction && (
              <span className="muted" id="local-focus-description">
                {t(
                  "이 기능의 역할·입력·실제 검사와 호출자가 지킬 조건을 설명합니다. 같은 파일의 관련 코드를 참고하도록 현재 파일 전체를 보냅니다.",
                  "Explain its purpose, inputs, actual checks and caller preconditions. The entire current file is sent as context for related code.",
                )}
              </span>
            )}
          </label>
        )}
        <label>
          {t(
            "요청 (설명은 비워도 됩니다)",
            "Request (optional for explanation)",
          )}
          <textarea
            rows={3}
            value={instruction}
            maxLength={2000}
            disabled={busy}
            onChange={(e) => {
              setInstruction(e.target.value);
              clearProposal();
            }}
            placeholder={
              task === "explain"
                ? t(
                    "예: 하는 일과 입력 조건을 설명해 줘. 실제 검사와 호출자가 지킬 전제를 구분해 줘.",
                    "Example: explain its purpose and inputs. Distinguish actual checks from caller preconditions.",
                  )
                : t(
                    "예: 배송비 기준을 바꾸고 영향을 설명해 줘",
                    "Example: change the shipping threshold and explain the effect",
                  )
            }
          />
        </label>
        {canObserve && (
          <details className="local-setup">
            <summary>
              {t(
                "예시 입력으로 설명 확인하기 (선택)",
                "Check the explanation with examples (optional)",
              )}
            </summary>
            <p>
              {t(
                "AI 없이 먼저 계산하고, 확인한 결과를 설명에 함께 보냅니다. 지원되는 JS/TS 구문에 한한 계산이며 실제 앱 테스트를 대신하지 않습니다.",
                "Calculate without AI first, then include these observations in the explanation. This covers supported JS/TS syntax and does not replace application tests.",
              )}
            </p>
            <label>
              {t(
                "예시 입력 · 예시마다 인수를 배열로 묶기",
                "Example inputs · one argument array per example",
              )}
              <textarea
                rows={3}
                maxLength={8000}
                disabled={busy || state.busy}
                value={exampleInputs}
                placeholder="[[0], [5]]"
                onChange={(event) => {
                  setExampleInputs(event.target.value);
                  setObserved(undefined);
                  clearProposal();
                }}
              />
            </label>
            <p className="muted">
              {t("인수 순서", "Argument order")}:{" "}
              {focusedFunction.params.map((p) => p.name).join(", ") ||
                t("없음", "none")}{" "}
              · {t("최대 8개 예시", "Up to 8 examples")}
            </p>
            <button
              disabled={busy || !eligible || !exampleInputs.trim()}
              onClick={() =>
                void run(async () => {
                  clearProposal();
                  setObserved(undefined);
                  const response = await request<ObservationView>(
                    "localObserve",
                    {
                      focusFunctionId: focusedFunction.id,
                      inputs: exampleInputs,
                    },
                    state.contextId,
                  );
                  if (
                    mounted.current &&
                    activeContext.current === state.contextId
                  )
                    setObserved({
                      context: state.contextId,
                      focusId: focusedFunction.id,
                      inputs: exampleInputs,
                      result: response,
                    });
                })
              }
            >
              {t("AI 없이 예시 계산", "Calculate examples without AI")}
            </button>
          </details>
        )}
        {observation && (
          <section aria-label={t("예시 계산 결과", "Calculation observations")}>
            <h3>
              {t(
                "설명에 첨부할 계산 결과",
                "Observations to include in the explanation",
              )}
            </h3>
            <p className="muted">
              {t(
                "이 입력들에서 관찰한 결과입니다. 확인 불가는 실제 코드의 예외나 결함이 확인됐다는 뜻이 아닙니다. 모델 설명과 대조해 주세요.",
                "These results apply to these inputs. Unavailable does not establish a real exception or bug. Compare them with the model's explanation.",
              )}
            </p>
            <ol>
              {observation.items.map((row, index) => (
                <li key={index}>
                  <span>{t("입력", "Inputs")}</span>
                  <pre>{row.args}</pre>
                  <span>
                    {row.status === "returned"
                      ? t("계산 결과", "Observed value")
                      : t("확인 불가", "Unavailable")}
                  </span>
                  <pre>{row.value}</pre>
                </li>
              ))}
            </ol>
          </section>
        )}
        {canConstrainWhitespace ? (
          <label className="local-ack">
            <input
              type="checkbox"
              disabled={busy}
              checked={whitespaceOnly}
              onChange={(event) => {
                setWhitespaceOnly(event.target.checked);
                clearProposal();
              }}
            />
            {t(
              "공백과 줄바꿈만 바꾸기 — 코드·문자열·주석·구조 변경은 적용하지 않기",
              "Only change spacing and line breaks — block changes to code, literals, comments or structure",
            )}
          </label>
        ) : null}
        {state.busy ? (
          <p role="status">
            {t(
              "현재 파일을 다시 읽는 중입니다…",
              "Refreshing the current file…",
            )}
          </p>
        ) : !eligible ? (
          <p className="banner">
            {t(
              "신뢰한 로컬 작업 공간에서 24KB 이하의 지원 파일을 열어 주세요.",
              "Open a supported file up to 24KB in a trusted local workspace.",
            )}
          </p>
        ) : null}
        <div className="local-actions">
          <button
            className="primary"
            disabled={
              busy ||
              !eligible ||
              !model ||
              (task !== "explain" && !instruction.trim())
            }
            onClick={() =>
              void run(async () => {
                clearProposal();
                const response = await request<AssistantResult>(
                  "localGenerate",
                  {
                    model,
                    processor,
                    timeoutSeconds,
                    task,
                    instruction,
                    lang,
                    ...(focusedFunction
                      ? { focusFunctionId: focusedFunction.id }
                      : {}),
                    ...(observation ? { observationId: observation.id } : {}),
                    ...(canConstrainWhitespace && whitespaceOnly
                      ? { editConstraint: "whitespace-only" }
                      : {}),
                  },
                  state.contextId,
                  (nextPhase) => {
                    if (
                      mounted.current &&
                      activeContext.current === state.contextId &&
                      activeLanguage.current === lang
                    )
                      setProgress({
                        context: state.contextId,
                        phase: nextPhase,
                      });
                  },
                );
                if (
                  mounted.current &&
                  activeContext.current === state.contextId &&
                  activeLanguage.current === lang
                )
                  setGenerated({
                    context: state.contextId,
                    lang,
                    result: response,
                  });
              }, true)
            }
          >
            {t("현재 파일로 요청하기", "Send current file")}
          </button>
          {busy ? (
            <button
              onClick={() =>
                void request("localCancel").catch((e) => setError(e.message))
              }
            >
              {t("취소", "Cancel")}
            </button>
          ) : null}
        </div>
        {busy ? (
          <p role="status">
            {generationStarted !== undefined
              ? `${phase ? localAIPhases[phase][lang] : t("요청 준비 중", "Preparing request")}… ${t("취소하거나 파일을 바꾸면 요청이 중단됩니다.", "Cancel or change the file to stop the request.")}`
              : t(
                  "요청한 작업을 처리하고 있습니다.",
                  "Processing the requested action.",
                )}
            {generationStarted !== undefined ? (
              <span role="timer" aria-live="off">
                {" "}
                · {t("전체 요청 경과", "Total request elapsed")}{" "}
                {elapsedSeconds}
                {t("초", "s")}
              </span>
            ) : null}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="banner error">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="banner">
            {notice[lang]}
          </p>
        ) : null}
      </div>
      {generated?.context === state.contextId && generated.lang !== lang ? (
        <p role="status" className="banner">
          {t(
            "이전 응답은 영어로 생성됐습니다. 한국어 설명은 다시 요청해 주세요.",
            "The previous response was generated in Korean. Send a new request for an English explanation.",
          )}
        </p>
      ) : null}
      {result ? (
        <section
          className="card local-result"
          tabIndex={-1}
          ref={output}
          aria-label={t("로컬 AI 결과", "Local AI result")}
        >
          <h2>{t("모델의 설명과 제안", "Model explanation and proposal")}</h2>
          {result.focus && (
            <p>
              {t("설명 대상", "Explanation focus")}:{" "}
              <code>{result.focus.name}</code> · L{result.focus.line}–
              {result.focus.endLine}
            </p>
          )}
          <p className="muted">
            {result.model} · {(result.elapsedMs / 1000).toFixed(1)}s ·{" "}
            {result.processor === "cpu"
              ? t("CPU 요청", "CPU requested")
              : t("Ollama 자동 설정", "Ollama automatic")}{" "}
            · {t("추론 결과 · 검토 필요", "Model inference · review required")}{" "}
            · {t("설정한 대기 한도", "Selected time limit")}{" "}
            {(result.timeoutSeconds ?? 180) / 60}
            {t("분", " min")}
          </p>
          <p className="local-summary">{result.summary}</p>
          {result.explanation && (
            <>
              <h3>{t("입력 검사에 대한 설명", "Input checks explained")}</h3>
              <p>{result.explanation.inputChecks}</p>
              <h3>
                {t("호출 조건에 대한 설명", "Caller requirements explained")}
              </h3>
              <p>{result.explanation.callerRequirements}</p>
              {result.explanation.examples.length > 0 && (
                <>
                  <h3>
                    {t(
                      "예시별 계산과 모델 설명",
                      "Each observation and its model explanation",
                    )}
                  </h3>
                  <p className="muted">
                    {t(
                      "계산 값은 프로그램이 제공하고 설명은 모델이 작성했습니다. 항목이 모두 있어도 설명이 정확하다는 뜻은 아닙니다.",
                      "Values come from the program; explanations come from the model. Complete coverage does not establish correctness.",
                    )}
                  </p>
                  {result.explanation.examples.map((item) => {
                    const observed = result.observations?.[item.case - 1];
                    const citation = result.citations[item.citation - 1];
                    return (
                      <div className="local-citation" key={item.case}>
                        <h4>
                          {t("예시", "Example")} {item.case}
                        </h4>
                        {observed && (
                          <>
                            <p>{t("입력", "Input")}</p>
                            <pre>{observed.args}</pre>
                            <p>
                              {observed.status === "returned"
                                ? t("프로그램 계산 값", "Program observation")
                                : t(
                                    "프로그램 확인 불가",
                                    "Program could not establish a result",
                                  )}
                            </p>
                            <pre>{observed.value}</pre>
                          </>
                        )}
                        <p>
                          <strong>{t("모델 설명", "Model explanation")}</strong>
                          : {item.explanation}
                        </p>
                        {citation && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(() =>
                                request(
                                  "localSource",
                                  { id: result.id, index: item.citation - 1 },
                                  state.contextId,
                                ),
                              )
                            }
                          >
                            {t("예시", "Example")} {item.case} ·{" "}
                            {t("원문 근거", "Source evidence")} L{citation.line}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}
          {result.observations && (
            <p className="muted">
              {t(
                "위 예시 계산 결과를 첨부한 설명입니다. 모델은 이 결과와 모순되는 답을 할 수 있으므로 값·원문과 대조하세요.",
                "Generated with the observations above. The model may still contradict them; compare its claims with the values and source.",
              )}
            </p>
          )}
          <h3>{t("원문에서 확인", "Check against the source")}</h3>
          {result.citations.map((c, i) => (
            <div className="local-citation" key={`${c.start}-${i}`}>
              <button
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    request(
                      "localSource",
                      { id: result.id, index: i },
                      state.contextId,
                    ),
                  )
                }
              >
                L{c.line}
              </button>
              <p>{c.explanation}</p>
              <pre>{c.quote}</pre>
            </div>
          ))}
          {result.risks.length ? (
            <>
              <h3>{t("주의할 변화", "Tradeoffs and uncertainty")}</h3>
              <ul>
                {result.risks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </>
          ) : null}
          {result.checks.length ? (
            <>
              <h3>
                {t(
                  "모델이 제안한 확인 항목 · 아직 실행하지 않음",
                  "Suggested checks · not executed",
                )}
              </h3>
              <ul>
                {result.checks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </>
          ) : null}
          {result.edits.length ? (
            <>
              <h3>
                {t("변경 제안", "Proposed changes")} · {result.edits.length}
              </h3>
              <ul>
                {result.edits.map((e, i) => (
                  <li key={i}>{e.reason}</li>
                ))}
              </ul>
              <p
                className={
                  result.validation.status === "syntax-failed"
                    ? "banner error"
                    : "banner"
                }
              >
                {result.validation.detail}
              </p>
              {result.constraint ? (
                <p
                  className={
                    result.constraint.status === "passed"
                      ? "banner"
                      : "banner error"
                  }
                >
                  {result.constraint.status === "passed"
                    ? t(
                        "선택한 공백·줄바꿈 제한을 확인했습니다. 요청 전체를 충족했는지는 차이에서 확인해 주세요.",
                        "The selected spacing-only restriction passed. Review the diff to check the full request was fulfilled.",
                      )
                    : result.constraint.status === "failed"
                      ? t(
                          "선택한 공백·줄바꿈 제한을 벗어나 적용할 수 없습니다. 차이를 확인하고 다시 요청해 주세요.",
                          "The proposal exceeds your spacing-only restriction and cannot be applied. Review the diff and request again.",
                        )
                      : t(
                          "공백·줄바꿈 제한을 확인할 수 없어 적용할 수 없습니다.",
                          "The spacing-only restriction could not be verified, so this proposal cannot be applied.",
                        )}
                </p>
              ) : null}
              {result.validation.changeFacts ? (
                <div className="banner">
                  <strong>
                    {t(
                      "원문과 직접 비교한 결과",
                      "Compared directly with the source",
                    )}
                  </strong>
                  {result.validation.changeFacts.status === "available" ? (
                    <>
                      <p>
                        {result.validation.changeFacts.whitespaceOnly
                          ? t(
                              "공백·줄바꿈만 달라졌고, 파서가 읽은 코드 구조와 주석은 같습니다.",
                              "Only spacing or line breaks differ; the parsed code structure and comment text match.",
                            )
                          : result.validation.changeFacts.codeTokensChanged ||
                              result.validation.changeFacts
                                .parseStructureChanged
                            ? t(
                                "코드 내용이나 구조도 달라졌습니다. 공백·들여쓰기만 바꾼 제안이 아닙니다.",
                                "Code content or structure also changed. This proposal changes more than spacing or indentation.",
                              )
                            : t(
                                "파서가 읽은 코드는 같지만 주석 등 원문 차이가 있습니다.",
                                "The parsed code matches, but comments or other source text differ.",
                              )}
                      </p>
                      {result.validation.changeFacts.braces.before !==
                      result.validation.changeFacts.braces.after ? (
                        <p>
                          {t("중괄호 수", "Curly braces")}:{" "}
                          {result.validation.changeFacts.braces.before} →{" "}
                          {result.validation.changeFacts.braces.after}
                        </p>
                      ) : null}
                      {result.validation.changeFacts.commentsChanged ? (
                        <p>
                          {t(
                            "주석 내용도 바뀌었습니다.",
                            "Comment text also changed.",
                          )}
                        </p>
                      ) : null}
                      <p className="muted">
                        {t(
                          "JS/TS 원문 비교입니다. 요청을 지켰는지, 실행 결과가 같은지는 별도 검토와 프로젝트 검사가 필요합니다.",
                          "This is a JS/TS source comparison. Request compliance and runtime equivalence still need review and project checks.",
                        )}
                      </p>
                    </>
                  ) : (
                    <p>
                      {t(
                        "원본 또는 변경안에 문법 오류가 있어 구조를 비교할 수 없습니다.",
                        "A syntax error in the original or proposal prevents a structural comparison.",
                      )}
                    </p>
                  )}
                </div>
              ) : null}
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await request(
                      "localPreview",
                      { id: result.id },
                      state.contextId,
                    );
                    if (mounted.current) setReviewed(true);
                  })
                }
              >
                {t("VS Code에서 전체 차이 검토", "Review full diff in VS Code")}
              </button>
              <label className="local-ack">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />
                {t(
                  "타입·실행 결과·성능은 검증되지 않았음을 확인했습니다.",
                  "I understand types, runtime behavior and performance remain unchecked.",
                )}
              </label>
              <button
                className="primary"
                disabled={
                  busy ||
                  !state.trusted ||
                  !reviewed ||
                  !acknowledged ||
                  result.validation.status === "syntax-failed" ||
                  (!!result.constraint && result.constraint.status !== "passed")
                }
                onClick={() =>
                  void run(async () => {
                    await request(
                      "localApply",
                      { id: result.id, acknowledgeUnchecked: acknowledged },
                      state.contextId,
                    );
                    if (mounted.current) {
                      clearProposal();
                      setNotice({
                        ko: "적용했습니다. 편집기의 실행 취소로 되돌릴 수 있습니다.",
                        en: "Applied. Use editor undo to revert.",
                      });
                    }
                  })
                }
              >
                {t("검토한 변경 적용", "Apply reviewed changes")}
              </button>
              <p className="muted">
                {t(
                  "자동 저장하지 않습니다. 편집기 자동 저장 설정은 그대로 적용됩니다. 최적화 효과는 별도 측정이 필요합니다.",
                  "No explicit save is performed; editor autosave settings still apply. Optimization effects require measurement.",
                )}
              </p>
            </>
          ) : (
            <p>
              {t("코드 변경 제안은 없습니다.", "No code changes proposed.")}
            </p>
          )}
        </section>
      ) : null}
    </section>
  );
}
