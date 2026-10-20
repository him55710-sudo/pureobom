import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Story, Steps } from "../../src/components/Story";
import { label } from "../../src/core/labels";
import type { Lang, Step } from "../../src/core/types";
import { functionNesting } from "../../src/core/functionNesting";

type Props = ComponentProps<typeof Story> & {
  onRules: () => void;
  onChecks: () => void;
  onMap: () => void;
  onFormat?: (functionId: string) => void;
  onExplain?: (functionId: string) => void;
  terminology: ReactNode;
};
export function ReadingView(props: Props) {
  const {
    analysis: a,
    lang,
    onSource,
    onRules,
    onChecks,
    onMap,
    terminology,
  } = props;
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const [selected, setSelected] = useState("");
  const [mode, setMode] = useState<"text" | "flow">("text");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(12);
  const fn = a.functions.find((f) => f.id === selected) || a.functions[0];
  const nesting = functionNesting(a.functions, fn?.id || "");
  const focusHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (selected && selected === fn?.id) focusHeading.current?.focus();
  }, [selected, fn?.id]);
  const matches = a.functions.filter((f) =>
    `${f.label[lang]} ${f.name}`.toLowerCase().includes(query.toLowerCase()),
  );
  const language = a.rust
    ? "Rust"
    : a.csharp
      ? "C#"
      : a.java
        ? "Java"
        : a.go
          ? "Go"
          : a.python
            ? "Python"
            : a.web?.language.toUpperCase() ||
              (a.sql ? "SQL" : a.kind === "json" ? "JSON" : "JS / TS");
  const script = a.kind === "script" && !a.web && !a.sql;
  const featured = a.rules
    .filter((r) => r.scope === "file" && r.type !== "operator")
    .slice(0, 3);
  return (
    <div className="reading-view">
      <section className="reading-intro">
        <div className="intro-kicker">
          <span className="evidence-dot" />
          {t("원문에서 확인한 구조", "STRUCTURE FROM SOURCE")}
          <span>{language}</span>
        </div>
        <h2>
          {script && fn
            ? t(
                "기능을 이해하고, 원하는 동작으로 바꿔보세요",
                "Understand the logic. Make it work your way.",
              )
            : t(
                "내용을 읽고, 필요한 부분을 바꾸세요",
                "Read the content. Change what you need.",
              )}
        </h2>
        <p>
          {script && fn
            ? t(
                `${a.functions.length}개 기능을 하나씩 살펴볼 수 있어요. 설명의 줄 번호를 누르면 근거가 되는 코드로 이동합니다.`,
                `Explore ${a.functions.length} functions one at a time. Every line link takes you to its source.`,
              )
            : t(
                "원문에 적힌 구조와 값을 보여 드립니다. 어떤 동작으로 이어지는지는 관련 코드와 함께 확인하세요.",
                "Explore the structure and values written in the file. Check related code to understand their effect.",
              )}
        </p>
        <div className="reading-shortcuts">
          <button onClick={onRules}>
            <strong>{a.rules.length}</strong>
            <span>{t("바꿀 수 있는 값", "editable values")}</span>
            <span aria-hidden="true">↗</span>
          </button>
          <button onClick={onChecks}>
            <strong>{a.issues.length}</strong>
            <span>{t("원문 검토 항목", "source review notes")}</span>
            <span aria-hidden="true">↗</span>
          </button>
          {!a.rust && (
            <button onClick={onMap}>
              <strong>{a.imports.length}</strong>
              <span>{t("가져오는 연결", "imports")}</span>
              <span aria-hidden="true">↗</span>
            </button>
          )}
        </div>
      </section>
      {a.rust && (
        <p className="reading-note" role="status">
          {t(
            "포함된 파서로 Rust 원문을 읽습니다. API·모델·Rust SDK가 필요하지 않습니다. 컴파일·타입·소유권·매크로 확장·cfg·모듈 연결·실제 동작은 별도 확인해야 합니다.",
            "Reads Rust source with the bundled parser; no API, model or Rust SDK required. Compilation, types, ownership, macro expansion, cfg, module links and runtime behavior need separate checks.",
          )}
          {a.rust.truncated &&
            t(
              " 표시 한도에 도달해 일부 구조와 값이 생략됐습니다. 원문도 확인하세요.",
              " Some structure and values were omitted at display limits. Also review the source.",
            )}
        </p>
      )}
      {!a.syntaxValid && (
        <p className="banner error" role="status">
          {t(
            "문법 오류가 있어 일부 설명이 정확하지 않을 수 있어요. 확인하기에서 먼저 살펴보세요.",
            "Syntax errors may affect this explanation. Review them in Check first.",
          )}
        </p>
      )}
      {script && fn ? (
        <>
          {a.functions.length > 1 && (
            <section
              className="function-picker"
              aria-label={t("읽을 기능 선택", "Choose a function")}
            >
              <div className="section-heading">
                <h3>
                  {t(
                    "어떤 기능을 살펴볼까요?",
                    "What would you like to understand?",
                  )}
                </h3>
                <span className="muted">
                  {a.functions.length} {t("개 기능", "functions")}
                </span>
              </div>
              {a.functions.length > 5 && (
                <input
                  type="search"
                  aria-label={t("기능 찾기", "Find a function")}
                  placeholder={t(
                    "이름으로 기능 찾기",
                    "Find a function by name",
                  )}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setLimit(12);
                  }}
                />
              )}
              <div className="function-options">
                {matches.slice(0, limit).map((f) => (
                  <button
                    key={f.id}
                    aria-pressed={fn.id === f.id}
                    onClick={() => setSelected(f.id)}
                  >
                    <span className="function-option-mark" aria-hidden="true">
                      ƒ
                    </span>
                    <span>
                      <strong>{f.label[lang]}</strong>
                      {f.label[lang] !== f.name && <small>{f.name}</small>}
                    </span>
                    <span className="muted">L{f.line}</span>
                  </button>
                ))}
              </div>
              {!matches.length && (
                <p role="status">
                  {t(
                    "일치하는 기능이 없어요. 다른 이름으로 찾아보세요.",
                    "No matching functions. Try another name.",
                  )}
                </p>
              )}
              {matches.length > limit && (
                <button
                  className="text-button"
                  onClick={() => setLimit(limit + 12)}
                >
                  {t(
                    `기능 더 보기 (${matches.length - limit}개)`,
                    `Show more (${matches.length - limit})`,
                  )}
                </button>
              )}
            </section>
          )}
          <section
            className="focus-function"
            aria-label={t(
              "선택한 기능의 설명",
              "Selected function explanation",
            )}
          >
            <header>
              <div>
                <span className="eyebrow">
                  {t("지금 살펴보는 기능", "FOCUS")}
                </span>
                <h2 ref={focusHeading} tabIndex={-1}>
                  {fn.label[lang]}
                </h2>
                <code className="muted">{fn.name}</code>
              </div>
              <button
                className="source-button"
                disabled={props.disabled}
                onClick={() => onSource(fn.line)}
              >
                {t("코드 근거", "Source")} <span>L{fn.line} ↗</span>
              </button>
            </header>
            <div className="input-summary">
              <span>{t("받는 정보", "INPUT")}</span>
              <p>
                {fn.params.length
                  ? fn.params
                      .map((p) => (p.label || label(p.name))[lang])
                      .join(" · ")
                  : t("따로 받는 정보가 없어요", "No parameters")}
              </p>
              {fn.async && (
                <small>{t("비동기 함수", "Asynchronous function")}</small>
              )}
            </div>
            {fn.note && <p className="reading-note">{fn.note[lang]}</p>}
            <div className="reading-mode">
              <strong>{t("안에서 일어나는 일", "Inside this function")}</strong>
              <div
                className="segmented"
                role="group"
                aria-label={t("설명 표현 방식", "Explanation format")}
              >
                <button
                  aria-pressed={mode === "text"}
                  onClick={() => setMode("text")}
                >
                  {t("문장", "Text")}
                </button>
                <button
                  aria-pressed={mode === "flow"}
                  onClick={() => setMode("flow")}
                >
                  {t("구조 흐름", "Structure")}
                </button>
              </div>
            </div>
            {mode === "text" ? (
              <Steps steps={fn.steps} lang={lang} onSource={onSource} />
            ) : (
              <>
                <p className="flow-caption">
                  {t(
                    "원문에 적힌 순서와 중첩 구조입니다. 모든 상자가 실행되는 것은 아니에요.",
                    "Source order and nesting, not a runtime trace. Not every box executes.",
                  )}
                </p>
                <SourceFlow steps={fn.steps} lang={lang} onSource={onSource} />
              </>
            )}
            {!fn.steps.length && (
              <p className="muted">
                {t(
                  "설명할 수 있는 본문이 없습니다. 원문을 확인해 주세요.",
                  "No supported body to explain. Check the source.",
                )}
              </p>
            )}
            {(nesting.parent || nesting.children.length > 0) && (
              <nav
                className="function-nesting"
                aria-label={t(
                  "안쪽·바깥 함수 읽기",
                  "Read inner and outer functions",
                )}
              >
                {nesting.parent && (
                  <button onClick={() => setSelected(nesting.parent!.id)}>
                    {t("바깥 함수 읽기", "Read outer function")}:{" "}
                    {nesting.parent.label[lang]} · L{nesting.parent.line}
                  </button>
                )}
                {nesting.children.length > 0 && (
                  <>
                    <h3>
                      {t(
                        "이 원문 안에 정의된 함수",
                        "Functions defined inside this source",
                      )}
                    </h3>
                    <p className="muted">
                      {t(
                        "따로 정의된 함수의 입력과 본문도 이어서 읽어보세요. 원문에 포함된 관계이며 호출 순서를 뜻하지 않습니다.",
                        "Continue into each function's inputs and body. These links show source nesting, not call order.",
                      )}
                    </p>
                    <div className="function-nesting-links">
                      {nesting.children.map((child) => (
                        <button
                          key={child.id}
                          onClick={() => setSelected(child.id)}
                        >
                          {t("본문 읽기", "Read body")}: {child.label[lang]} · L
                          {child.line}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </nav>
            )}
            <footer>
              <span>
                {t(
                  "구문에서 읽은 설명 · 실제 동작은 별도 확인",
                  "Syntax-based · runtime behavior needs checking",
                )}
              </span>
              {props.onExplain && (
                <button
                  disabled={props.editDisabled}
                  onClick={() => props.onExplain!(fn.id)}
                >
                  {t(
                    "이 기능을 로컬 AI로 설명",
                    "Explain this function with local AI",
                  )}
                </button>
              )}
              {props.onFormat && (
                <button
                  disabled={props.editDisabled || !a.syntaxValid}
                  onClick={() => props.onFormat!(fn.id)}
                >
                  {t("이 기능의 줄바꿈 정리", "Format this function")}
                </button>
              )}
              {fn.simulatable && (
                <button
                  className="primary"
                  disabled={props.disabled}
                  onClick={() => props.onSimulate(fn.name)}
                >
                  {t("예시 값으로 확인 →", "Try example inputs →")}
                </button>
              )}
            </footer>
          </section>
          {featured.length > 0 && (
            <section className="featured-rules">
              <div className="section-heading">
                <h3>
                  {t(
                    "이 파일에서 바로 바꿀 수 있어요",
                    "Values you can change in this file",
                  )}
                </h3>
                <button className="text-button" onClick={onRules}>
                  {t("전체 보기 →", "View all →")}
                </button>
              </div>
              <div className="value-cards">
                {featured.map((r) => (
                  <button
                    key={r.id}
                    disabled={props.editDisabled || !a.syntaxValid}
                    onClick={() => props.onEdit(r)}
                  >
                    <span>{r.label[lang]}</span>
                    <strong>
                      {r.raw.length > 70 ? r.raw.slice(0, 70) + "…" : r.raw}
                    </strong>
                    <small>{t("값 바꾸기 →", "Change value →")}</small>
                  </button>
                ))}
              </div>
            </section>
          )}
          <details className="disclosure">
            <summary>
              {t(
                "파일 전체 설명과 세부 구조",
                "Full file explanation and details",
              )}
            </summary>
            <Story {...props} />
          </details>
        </>
      ) : (
        <Story {...props} />
      )}
      {terminology}
    </div>
  );
}

function SourceFlow({
  steps,
  lang,
  onSource,
  depth = 0,
}: {
  steps: Step[];
  lang: Lang;
  onSource: (line: number) => void;
  depth?: number;
}) {
  const ko = lang === "ko";
  if (depth >= 4)
    return (
      <p className="flow-caption">
        {ko
          ? "더 깊은 구조는 문장 보기나 원문에서 확인하세요."
          : "See Text or source for deeper nesting."}
      </p>
    );
  return (
    <ol className="source-flow">
      {steps.slice(0, 15).map((step) => (
        <li key={step.id}>
          <div className={`flow-node flow-${step.kind}`}>
            <span className="flow-node-type">
              {step.supported
                ? step.kind === "condition" ||
                  step.kind === "branch" ||
                  step.otherwise
                  ? ko
                    ? "조건과 갈림길"
                    : "Branch"
                  : step.kind === "return"
                    ? ko
                      ? "결과 반환"
                      : "Return"
                    : step.kind === "error"
                      ? ko
                        ? "오류 처리"
                        : "Error"
                      : ko
                        ? "처리 단계"
                        : "Step"
                : ko
                  ? "원문 확인 필요"
                  : "Review source"}
            </span>
            <p>{step.text[lang]}</p>
            <button className="line-link" onClick={() => onSource(step.line)}>
              L{step.line} ↗
            </button>
          </div>
          {step.children.length > 0 && (
            <SourceFlow
              steps={step.children}
              lang={lang}
              onSource={onSource}
              depth={depth + 1}
            />
          )}
          {step.otherwise && (
            <div className="flow-branch">
              <span>
                {step.kind === "guard"
                  ? ko
                    ? "오류가 나면"
                    : "On error"
                  : ko
                    ? "그렇지 않으면"
                    : "Otherwise"}
              </span>
              <SourceFlow
                steps={step.otherwise}
                lang={lang}
                onSource={onSource}
                depth={depth + 1}
              />
            </div>
          )}
          {step.branches?.map((branch, i) => (
            <div className="flow-branch" key={i}>
              <span>{branch.label[lang]}</span>
              <SourceFlow
                steps={branch.steps}
                lang={lang}
                onSource={onSource}
                depth={depth + 1}
              />
            </div>
          ))}
          {step.finalizer && (
            <SourceFlow
              steps={[step.finalizer]}
              lang={lang}
              onSource={onSource}
              depth={depth + 1}
            />
          )}
        </li>
      ))}
      {steps.length > 15 && (
        <li className="flow-caption">
          {ko
            ? `나머지 ${steps.length - 15}개 단계는 문장 보기에서 확인하세요.`
            : `See Text for ${steps.length - 15} more steps.`}
        </li>
      )}
    </ol>
  );
}
