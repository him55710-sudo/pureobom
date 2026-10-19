import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ReadingView } from "./ReadingView";
import { RuleWorkbench } from "./RuleWorkbench";
import { MapView } from "../../src/components/MapView";
import { ScenarioLab } from "../../src/components/ScenarioLab";
import { Terminology } from "../../src/components/Terminology";
import { ProductHelp } from "../../src/components/ProductHelp";
import { EditorProblems } from "./EditorProblems";
import { LocalAssistant } from "./LocalAssistant";
import { ProjectChecks } from "./ProjectChecks";
import type { ScenarioReport } from "../../src/core/scenarioModel";
import type { Lang, Rule, Simulation, Words } from "../../src/core/types";
import { displayValue } from "../../src/core/previewValues";
import { PreviewValueHelp } from "../../src/components/PreviewValueHelp";
import type { FormatSummary, PatchSummary, ViewState } from "../src/protocol";
import { host, request } from "./bridge";
import "./style.css";
import "./journey.css";

type Tab = "story" | "rules" | "checks" | "map" | "local";
function App() {
  const saved = host.getState() as { lang?: Lang } | undefined;
  const [lang, setLang] = useState<Lang>(saved?.lang === "en" ? "en" : "ko");
  const [state, setState] = useState<ViewState>({
    contextId: "",
    path: "",
    version: 0,
    dirty: false,
    trusted: true,
    busy: false,
  });
  const [tab, setTab] = useState<Tab>("story");
  const [assistantFocus, setAssistantFocus] = useState<{
    context: string;
    id: string;
  }>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Words>();
  const [help, setHelp] = useState(false);
  const [working, setWorking] = useState(false);
  const [edit, setEdit] = useState<Rule>();
  const [value, setValue] = useState("");
  const [sentence, setSentence] = useState("");
  const [patch, setPatch] = useState<PatchSummary>();
  const [fn, setFn] = useState("");
  const [args, setArgs] = useState("[50000]");
  const [simulation, setSimulation] = useState<Simulation>();
  const context = useRef("");
  const draftRevision = useRef(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const patchRef = useRef<HTMLElement>(null);
  const simulationRef = useRef<HTMLElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const ko = lang === "ko",
    a = state.analysis;
  const disabled = working || state.busy || !a;
  const scenarioFn =
    a?.functions.find((f) => f.name === fn) ??
    a?.functions.find((f) => f.simulatable);
  const t = (k: string, e: string) => (ko ? k : e);
  useEffect(() => {
    const receive = (e: MessageEvent) => {
      if (e.data?.type !== "state") return;
      const next = e.data.state as ViewState;
      if (context.current !== next.contextId) {
        draftRevision.current++;
        setNotice(undefined);
        setPatch(undefined);
        setEdit(undefined);
        setSimulation(undefined);
        setFn("");
        setError("");
        context.current = next.contextId;
      }
      setState(next);
      if (next.tab === "map") setTab("map");
      if (next.tab === "local") setTab("local");
    };
    window.addEventListener("message", receive);
    void request("ready").catch((e) => setError(e.message));
    return () => window.removeEventListener("message", receive);
  }, []);
  useEffect(() => {
    host.setState({ lang });
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    if (error || state.error) errorRef.current?.focus();
    else if (notice) noticeRef.current?.focus();
  }, [error, state.error, notice]);
  async function action(job: () => Promise<void>) {
    setWorking(true);
    setError("");
    setNotice(undefined);
    try {
      await job();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(false);
    }
  }
  function selectRule(rule: Rule) {
    draftRevision.current++;
    setEdit(rule);
    setValue(String(rule.value));
    setPatch(undefined);
    setTab("rules");
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      editorRef.current
        ?.querySelector<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >("input, select, textarea")
        ?.focus();
    });
  }
  async function prepare(payload: Record<string, unknown>) {
    const id = context.current;
    const draft = draftRevision.current;
    const result = await request<PatchSummary>("prepare", payload, id);
    if (id === context.current && draft === draftRevision.current) {
      setPatch(result);
      requestAnimationFrame(() => {
        patchRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        patchRef.current?.focus({ preventScroll: true });
      });
    }
  }
  async function format(functionId: string) {
    const id = context.current,
      draft = ++draftRevision.current;
    setPatch(undefined);
    setEdit(undefined);
    const result = await request<FormatSummary>(
      "formatFunction",
      { functionId },
      id,
    );
    if (id !== context.current || draft !== draftRevision.current) return;
    if ("unchanged" in result) {
      setNotice(result.description);
      return;
    }
    setPatch(result);
    setTab("rules");
    requestAnimationFrame(() => {
      patchRef.current?.scrollIntoView({ block: "center" });
      patchRef.current?.focus({ preventScroll: true });
    });
  }
  const source = (line: number) =>
    void action(() => request("source", { line }, state.contextId));
  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-icon">풀</span>
          <div>
            <strong>풀어봄</strong>
            <small>
              {t(
                "코드를 이해하는 작업 공간",
                "A workspace for understanding code",
              )}
            </small>
          </div>
        </div>
        <div className="product-links">
          <button onClick={() => setHelp(true)}>
            {t("도움말·피드백", "Help & feedback")}
          </button>
          <select
            aria-label="설명 언어 / Language"
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
          </select>
        </div>
      </header>
      <section className="file-summary">
        <span className="eyebrow">{t("지금 읽는 파일", "CURRENT FILE")}</span>
        <h1>
          {state.path || t("코드 파일을 열어 주세요", "Open a code file")}
        </h1>
        <div className="meta">
          <span className="pill">
            {state.busy
              ? t("설명 업데이트 중…", "Updating…")
              : !a
                ? t("지원 파일을 기다리는 중", "Waiting for a supported file")
                : a.kind === "text"
                  ? t("문법 기반 설명 미제공", "No built-in syntax explanation")
                  : t("내 컴퓨터에서 분석", "Analyzed locally")}
          </span>
          {state.path && (
            <span>
              {state.dirty
                ? t("저장 전 변경 포함", "Includes unsaved edits")
                : t("저장된 내용", "Saved content")}
            </span>
          )}
          {a?.web ? (
            <span>
              {a.web.nodes} {t("개 원문 항목", "source entries")} ·{" "}
              {a.rules.length} {t("개 수정 가능", "editable values")}
            </span>
          ) : a && a.kind === "json" ? (
            <span>
              {a.data?.fields.length ?? 0} {t("개 데이터 항목", "data entries")}{" "}
              · {a.rules.length} {t("개 수정 가능", "editable values")}
            </span>
          ) : a && a.kind === "script" ? (
            <span>
              {a.functions.length} {t("개 기능", "functions")} ·{" "}
              {a.rules.length} {t("개 규칙", "rules")}
            </span>
          ) : null}
          <button
            disabled={working || state.busy}
            onClick={() => void action(() => request("refresh"))}
          >
            {t("새로 읽기", "Refresh")}
          </button>
        </div>
      </section>
      {!state.trusted && (
        <p className="banner">
          {t(
            "제한 모드: 설명은 읽을 수 있습니다. 코드 변경은 작업 공간을 신뢰한 뒤 가능합니다.",
            "Restricted Mode: read explanations now; edits require a trusted workspace.",
          )}
        </p>
      )}
      {(error || state.error) && (
        <p className="banner error" role="alert" ref={errorRef} tabIndex={-1}>
          {error || state.error}
        </p>
      )}
      {notice && (
        <div
          className="banner success"
          role="status"
          ref={noticeRef}
          tabIndex={-1}
        >
          <p>{notice[lang]}</p>
          <button onClick={() => setTab("checks")}>
            {t("확인하기로 이동 →", "Go to Check →")}
          </button>
        </div>
      )}
      {state.path &&
        state.diagnostics &&
        (state.diagnostics.errors > 0 ||
          state.diagnostics.warnings > 0 ||
          state.diagnostics.status === "edited") && (
          <button
            className="diagnostic-summary"
            onClick={() => setTab("checks")}
          >
            <span>{t("편집기 알림", "Editor reports")}</span>
            <strong>
              {t("오류", "Errors")} {state.diagnostics.errors} ·{" "}
              {t("경고", "Warnings")} {state.diagnostics.warnings}
            </strong>
            <span>
              {state.diagnostics.status === "edited"
                ? t("코드 변경 후 갱신 대기", "Awaiting reports after edit")
                : t("내용 확인 →", "Review →")}
            </span>
          </button>
        )}
      {!a && !state.busy ? (
        <section className="empty card">
          <h2>
            {t(
              "어려운 코드, 문장으로 읽어 보세요",
              "Read your code as a story",
            )}
          </h2>
          <p>
            {t(
              "프로젝트의 파일을 열면 설명이 나타나요. 처음이라면 작은 예제로 이해하기 → 바꾸기 → 확인하기를 따라가 보세요.",
              "Open a project file to read it. New here? Try a small example and follow Understand → Change → Check.",
            )}
          </p>
          <button
            className="primary"
            onClick={() => void action(() => request("example"))}
          >
            {t("무료 배송 예제로 시작", "Try the shipping example")}
          </button>
          <p className="muted">
            {t(
              "기본 설명에는 API 키가 필요 없어요. AI 도움은 원할 때 따로 사용할 수 있습니다.",
              "Built-in explanations need no API key. AI help is an optional separate tool.",
            )}
          </p>
        </section>
      ) : (
        <>
          <nav className="tabs" aria-label={t("설명 보기 방식", "Views")}>
            {(
              [
                ["story", "이해하기", "Understand"],
                ["rules", "바꾸기", "Change"],
                ["checks", "확인하기", "Check"],
                ["map", "연결 지도", "Connections"],
                ["local", "AI 도움", "AI help"],
              ] as const
            ).map(([key, korean, english], index) => (
              <button
                key={key}
                aria-pressed={tab === key}
                className={`${tab === key ? "selected" : ""} ${index > 2 ? "tool-nav" : "journey-nav"}`}
                onClick={() => setTab(key)}
              >
                {index < 3 && (
                  <span className="nav-number" aria-hidden="true">
                    {index + 1}
                  </span>
                )}
                {t(korean, english)}
                {key === "checks" && !!a?.issues.length && (
                  <span className="count">{a.issues.length}</span>
                )}
              </button>
            ))}
          </nav>
          <main aria-busy={state.busy}>
            {state.language === "go" && state.busy ? (
              <p role="status">
                {t(
                  "Go 구문을 읽고 있습니다. 처음 사용할 때는 설치된 Go로 읽기 도구를 준비해 시간이 더 걸릴 수 있습니다.",
                  "Reading Go syntax. The first use may take longer while the installed Go SDK builds the reader.",
                )}
              </p>
            ) : null}
            {state.language === "java" && state.busy ? (
              <p role="status">
                {t(
                  "Java 구문을 읽고 있습니다. 처음 사용할 때는 설치된 JDK로 읽기 도구를 준비합니다.",
                  "Reading Java syntax. The first use prepares the reader with the installed JDK.",
                )}
              </p>
            ) : null}
            {state.language === "csharp" && state.busy ? (
              <p role="status">
                {t(
                  "C# 구문을 읽고 있습니다. 처음 사용할 때는 설치된 .NET SDK로 읽기 도구를 준비합니다.",
                  "Reading C# syntax. The first use prepares the reader with the installed .NET SDK.",
                )}
              </p>
            ) : null}
            {state.pythonNotice ||
            state.goNotice ||
            state.javaNotice ||
            state.csharpNotice ||
            state.rustNotice ? (
              <section className="card" role="status">
                <p>
                  {state.pythonNotice ||
                    state.goNotice ||
                    state.javaNotice ||
                    state.csharpNotice ||
                    state.rustNotice}
                </p>
                {state.csharpNotice ? (
                  <p>
                    {t(
                      ".NET SDK 8 이상을 설치하세요. 런타임만으로는 부족합니다. 필요하면 pureobom.analysisDotnet에 dotnet 실행 파일의 절대 경로를 지정하고 새로 읽기를 누르세요. 로컬 데스크톱 작업 공간에서 사용하세요.",
                      "Install .NET SDK 8 or later; a runtime alone is insufficient. Optionally set the absolute dotnet executable in pureobom.analysisDotnet and refresh. Use a local desktop workspace.",
                    )}
                  </p>
                ) : null}
                {state.javaNotice ? (
                  <p>
                    {t(
                      "JDK 21 이상을 설치하세요. 필요한 경우 pureobom.analysisJavaHome에 JDK 폴더의 절대 경로를 지정할 수 있습니다. 로컬 데스크톱 작업 공간에서 사용하세요.",
                      "Install JDK 21 or later. Optionally set the absolute JDK directory in pureobom.analysisJavaHome. Use a local desktop workspace.",
                    )}
                  </p>
                ) : null}
                {state.goNotice ? (
                  <p>
                    {t(
                      "Go SDK 설치 후 pureobom.analysisGo 설정에서 실행 파일 경로를 지정할 수 있습니다. 로컬 데스크톱 작업 공간에서 사용하세요.",
                      "Install a Go SDK and optionally set its executable path in pureobom.analysisGo. Use a local desktop workspace.",
                    )}
                  </p>
                ) : null}
              </section>
            ) : null}
            {a && tab === "local" && (
              <>
                <LocalAssistant
                  state={state}
                  lang={lang}
                  initialFocus={assistantFocus}
                />
                <ProjectChecks state={state} lang={lang} />
              </>
            )}
            {a?.kind === "text" && tab !== "local" && (
              <section className="card">
                <p>
                  {["python", "go", "java", "csharp", "rust"].includes(
                    state.language || "",
                  )
                    ? t(
                        "구문 읽기 도구를 사용할 수 없습니다. 위 안내를 확인하거나 로컬 AI에서 설명을 요청할 수 있습니다.",
                        "The syntax reader is unavailable. Check the notice above or request a local AI explanation.",
                      )
                    : t(
                        "이 언어의 문법 기반 설명은 아직 제공하지 않습니다. 로컬 AI에서 현재 파일의 설명이나 변경을 요청할 수 있습니다.",
                        "Syntax-grounded explanation is not available for this language yet. Local AI can propose explanations and changes for the current file.",
                      )}
                </p>
                <button onClick={() => setTab("local")}>
                  {t("로컬 AI 열기", "Open local AI")}
                </button>
              </section>
            )}
            {a && tab === "story" && (
              <ReadingView
                key={a.path}
                analysis={a}
                lang={lang}
                disabled={disabled}
                editDisabled={disabled || !state.trusted}
                onSource={source}
                onEdit={selectRule}
                onRules={() => setTab("rules")}
                onChecks={() => setTab("checks")}
                onMap={() => setTab("map")}
                onExplain={(id) => {
                  setAssistantFocus({ context: state.contextId, id });
                  setTab("local");
                }}
                onFormat={
                  state.language &&
                  [
                    "javascript",
                    "javascriptreact",
                    "typescript",
                    "typescriptreact",
                  ].includes(state.language)
                    ? (functionId) => void action(() => format(functionId))
                    : undefined
                }
                terminology={
                  <Terminology
                    key={a.path}
                    terms={a.terms || []}
                    lang={lang}
                    disabled={disabled}
                    onSource={source}
                    onSave={async (symbolId, label) => {
                      await request(
                        "term",
                        { symbolId, label, lang },
                        state.contextId,
                      );
                      setNotice({
                        ko: "내 용어를 설명에 반영했습니다. 원본 코드 이름은 유지됩니다.",
                        en: "Your term is now used in explanations. Source names are unchanged.",
                      });
                    }}
                  />
                }
                onSqlDialect={(dialect) =>
                  void action(() =>
                    request(
                      "sqlDialect",
                      { dialect: dialect || "" },
                      state.contextId,
                    ),
                  )
                }
                onSimulate={(name) => {
                  setFn(name);
                  setTab("checks");
                  setSimulation(undefined);
                  setArgs("[]");
                }}
              />
            )}
            {a && tab === "rules" && (
              <RuleWorkbench
                key={a.path}
                analysis={a}
                lang={lang}
                disabled={disabled}
                trusted={state.trusted}
                edit={edit}
                value={value}
                patch={patch}
                sentence={sentence}
                onSelect={selectRule}
                onValue={(next) => {
                  draftRevision.current++;
                  setValue(next);
                  setPatch(undefined);
                }}
                onSentence={(next) => {
                  draftRevision.current++;
                  setSentence(next);
                  setPatch(undefined);
                }}
                onPrepare={(payload) => void action(() => prepare(payload))}
                onClose={() => {
                  draftRevision.current++;
                  setEdit(undefined);
                  setPatch(undefined);
                }}
                onSource={source}
                editorRef={editorRef}
                patchRef={patchRef}
                onPreview={() =>
                  void action(async () => {
                    const reviewing = patch!;
                    await request(
                      "preview",
                      { id: reviewing.id, lang },
                      state.contextId,
                    );
                    setPatch((current) =>
                      current?.id === reviewing.id
                        ? { ...current, reviewed: true }
                        : current,
                    );
                  })
                }
                onApply={() =>
                  void action(async () => {
                    await request("apply", { id: patch!.id }, state.contextId);
                    setPatch(undefined);
                    setNotice({
                      ko: "편집기에 적용했어요. Ctrl+Z로 되돌릴 수 있습니다. 확인하기에서 결과를 살펴보세요.",
                      en: "Applied to the editor. Undo with Ctrl+Z. Review the result in Check.",
                    });
                  })
                }
                comparison={
                  patch && scenarioFn ? (
                    <ScenarioLab
                      key={`${state.contextId}:${patch.id}:${scenarioFn.name}`}
                      fn={scenarioFn}
                      rules={a.rules}
                      lang={lang}
                      revision={`${state.contextId}:${patch.id}`}
                      change={patch}
                      disabled={disabled}
                      run={(scenarios) =>
                        request<ScenarioReport>(
                          "compare",
                          {
                            name: scenarioFn.name,
                            scenarios,
                            patchId: patch.id,
                          },
                          state.contextId,
                        )
                      }
                      exportReport={(content) =>
                        request<void>("report", { content }, state.contextId)
                      }
                    />
                  ) : undefined
                }
              />
            )}
            {a && tab === "checks" && (
              <>
                <div className="journey-heading">
                  <span className="eyebrow">
                    {t("의도한 대로 바뀌었는지", "CHECK YOUR INTENT")}
                  </span>
                  <h2>
                    {t(
                      "결과와 근거를 함께 확인하세요",
                      "Check results alongside the evidence",
                    )}
                  </h2>
                  <p>
                    {t(
                      "편집기가 알려준 문제부터 읽고, 예시 입력과 프로젝트 검사로 동작을 확인해 보세요.",
                      "Start with editor reports, then try sample inputs and project checks.",
                    )}
                  </p>
                </div>
                {fn && scenarioFn && (
                  <section ref={simulationRef} className="example-check">
                    <ScenarioLab
                      key={`${state.contextId}:${scenarioFn.name}`}
                      fn={scenarioFn}
                      rules={a.rules}
                      lang={lang}
                      revision={state.contextId}
                      disabled={disabled}
                      run={(scenarios) =>
                        request<ScenarioReport>(
                          "compare",
                          { name: scenarioFn.name, scenarios },
                          state.contextId,
                        )
                      }
                      exportReport={(content) =>
                        request<void>("report", { content }, state.contextId)
                      }
                    />
                  </section>
                )}
                {state.diagnostics && (
                  <EditorProblems
                    snapshot={state.diagnostics}
                    lang={lang}
                    disabled={disabled}
                    onSource={(revision, id) =>
                      void action(() =>
                        request(
                          "diagnosticSource",
                          { revision, id },
                          state.contextId,
                        ),
                      )
                    }
                  />
                )}
                <span className="eyebrow">REVIEW WITH CONTEXT</span>
                <h2>{t("한 번 더 살펴볼 부분", "Things to review")}</h2>
                <p className="muted">
                  {t(
                    "아래 항목은 구문 검사와 정해진 패턴에 따른 제안입니다. 실제 버그를 확정하거나 전체 코드의 품질을 보증하지 않습니다.",
                    "These are syntax checks and pattern-based suggestions, not a complete audit.",
                  )}
                </p>
                {a.issues.map((issue) => (
                  <section key={issue.id} className="card issue">
                    <span className="pill">
                      {issue.level === "error"
                        ? t("문법 오류", "Syntax error")
                        : t("확인 필요", "Review")}
                    </span>
                    <h3>{issue.title[lang]}</h3>
                    <p>{issue.detail[lang]}</p>
                    <button
                      className="line-link"
                      onClick={() => source(issue.line)}
                    >
                      {t("해당 코드 보기", "View source")} · L{issue.line}
                    </button>
                  </section>
                ))}
                {!a.issues.length && (
                  <p className="card">
                    {t(
                      "지원하는 검사에서 제안할 항목을 찾지 못했습니다. 모든 동작이 검증되었다는 뜻은 아닙니다.",
                      "No findings from the supported checks. This does not verify all behavior.",
                    )}
                  </p>
                )}
                <details className="disclosure">
                  <summary>
                    {t(
                      "프로젝트 검사와 성능 측정",
                      "Project checks and performance",
                    )}
                  </summary>
                  <ProjectChecks state={state} lang={lang} />
                </details>
              </>
            )}
            {tab === "map" && (
              <>
                <div className="actions">
                  <button
                    className="primary"
                    disabled={working || state.busy}
                    onClick={() => void action(() => request("scan"))}
                  >
                    {t("작업 공간 연결 읽기", "Scan workspace")}
                  </button>
                </div>
                <p className="muted">
                  {state.scanNote ||
                    t(
                      "열어 본 파일의 연결을 표시합니다. 프로젝트 전체 연결은 위 버튼으로 읽어 주세요.",
                      "Showing files read so far. Scan the workspace to find more connections.",
                    )}
                </p>
                <MapView
                  files={state.project?.files || []}
                  lang={lang}
                  onSelect={(path) =>
                    void action(async () => {
                      await request("select", { path });
                      setTab("story");
                    })
                  }
                />
              </>
            )}
          </main>
        </>
      )}
      {fn && tab === "checks" && (
        <details className="disclosure simulation">
          <summary>
            {t("고급: JSON 인자로 직접 확인", "Advanced: enter JSON arguments")}
          </summary>
          <div className="section-heading">
            <h2>
              {t("값을 넣어 확인", "Try inputs")} · <code>{fn}</code>
            </h2>
            <button
              onClick={() => {
                setFn("");
                setSimulation(undefined);
              }}
            >
              {t("닫기", "Close")}
            </button>
          </div>
          <p className="muted">
            {t(
              "제한된 계산을 따라가는 모의 실행입니다. 사용자 코드를 직접 실행하거나 네트워크를 호출하지 않습니다.",
              "A restricted interpreter follows supported calculations without executing arbitrary code or making network calls.",
            )}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                const id = state.contextId;
                const result = await request<Simulation>(
                  "simulate",
                  { name: fn, args },
                  id,
                );
                if (id === context.current) setSimulation(result);
              });
            }}
          >
            <label htmlFor="args">
              {t(
                "받는 정보 순서대로 입력 (예: [50000])",
                "Arguments in order (e.g. [50000])",
              )}
            </label>
            <div className="input-row">
              <input
                id="args"
                value={args}
                onChange={(e) => setArgs(e.target.value)}
              />
              <button disabled={disabled}>{t("결과 확인", "Evaluate")}</button>
            </div>
          </form>
          {simulation && (
            <>
              <pre>
                {simulation.ok
                  ? displayValue(simulation.result)
                  : simulation.error}
              </pre>
              {simulation.ok && (
                <PreviewValueHelp values={[simulation.result]} lang={lang} />
              )}
              <ol>
                {simulation.trace.map((step, i) => (
                  <li key={i}>
                    {step.text}{" "}
                    <button
                      className="line-link"
                      onClick={() => source(step.line)}
                    >
                      L{step.line}
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
        </details>
      )}
      <footer className="app-footer">
        {t(
          "기본 읽기는 지원되는 구문과 원문에 기반합니다. 선택형 로컬 AI의 설명·수정은 모델의 제안이며 의미·동작·성능 검토가 필요합니다.",
          "Built-in reading uses supported syntax and source text. Optional local AI output is a model proposal; review its meaning, behavior and performance.",
        )}
      </footer>
      {help && (
        <ProductHelp
          lang={lang}
          environment="vscode"
          example={false}
          onClose={() => setHelp(false)}
          onOpen={(resource) => request("openResource", { resource })}
          onCopy={(text) => request("copyFeedback", { text })}
        />
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
