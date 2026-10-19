import { useState } from "react";
import type {
  Lang,
  Patch,
  Simulation,
  SourceFile,
  FunctionInfo,
} from "../core/types";
import { request } from "../client";
import { Icon } from "./Icon";
import { displayValue } from "../core/previewValues";
import { PreviewValueHelp } from "./PreviewValueHelp";
export function Simulator({
  files,
  path,
  fn,
  patch,
  lang,
}: {
  files: SourceFile[];
  path: string;
  fn: FunctionInfo;
  patch: Patch | null;
  lang: Lang;
}) {
  const ko = lang === "ko";
  const [args, setArgs] = useState(
    JSON.stringify(
      fn.params.map((p) =>
        p.type === "boolean"
          ? true
          : p.type === "number"
            ? 60000
            : p.type === "string"
              ? ""
              : null,
      ),
    ),
  );
  const [result, setResult] = useState<{
    before: Simulation;
    after?: Simulation;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function run() {
    setError("");
    setResult(null);
    setBusy(true);
    try {
      const input = JSON.parse(args);
      if (!Array.isArray(input))
        throw Error(
          ko
            ? "대괄호로 감싼 입력 목록이 필요합니다."
            : "Inputs must be a JSON array.",
        );
      const before = await request<Simulation>("simulate", {
        files,
        path,
        name: fn.name,
        args: input,
      });
      const after = patch
        ? await request<Simulation>("simulate", {
            files: files.map((f) =>
              f.path === patch.path ? { ...f, content: patch.updated } : f,
            ),
            path,
            name: fn.name,
            args: input,
          })
        : undefined;
      setResult({ before, after });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const output = (r: Simulation) => (r.ok ? displayValue(r.result) : r.error);
  return (
    <div className="simulator">
      <div className="section-heading">
        <div>
          <span className="eyebrow">TRY A SCENARIO</span>
          <h3>
            {ko
              ? "값을 넣으면 어떤 일이 생길까요?"
              : "What happens with these inputs?"}
          </h3>
        </div>
        <Icon name="play" />
      </div>
      <p className="muted">
        {fn.label[lang]} <code>{fn.name}</code>
      </p>
      <label htmlFor="simulation-input">
        {ko ? "받는 정보 순서" : "Input order"}:{" "}
        {fn.params
          .map((p) => (p.label ? `${p.label[lang]} (${p.name})` : p.name))
          .join(", ") || "없음 / none"}
      </label>
      <div className="input-action">
        <input
          id="simulation-input"
          value={args}
          onChange={(e) => {
            setArgs(e.target.value);
            setResult(null);
          }}
          spellCheck={false}
        />
        <button className="button primary" disabled={busy} onClick={run}>
          {busy ? "…" : ko ? "결과 확인" : "Try inputs"}
        </button>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div className="simulation-results">
          <div className="result-box">
            <span className="mini-label">
              {patch
                ? ko
                  ? "변경 전"
                  : "BEFORE"
                : ko
                  ? "계산 결과"
                  : "RESULT"}
            </span>
            <pre className={!result.before.ok ? "error-text" : ""}>
              {output(result.before)}
            </pre>
          </div>
          {result.after && (
            <div className="result-box after">
              <span className="mini-label">{ko ? "변경 후" : "AFTER"}</span>
              <pre className={!result.after.ok ? "error-text" : ""}>
                {output(result.after)}
              </pre>
            </div>
          )}
          <PreviewValueHelp
            values={[result.before, result.after]
              .filter((r) => r?.ok)
              .map((r) => r!.result)}
            lang={lang}
          />
          <details>
            <summary>{ko ? "판단 과정 보기" : "View decision trace"}</summary>
            {(result.after || result.before).trace.map((t, i) => (
              <div className="trace" key={i}>
                {t.path && (
                  <code>
                    {t.path} · L{t.line}
                  </code>
                )}
                {t.text}
              </div>
            ))}
          </details>
        </div>
      )}
      <p className="footnote">
        {ko
          ? "제한된 계산 모형입니다. 지원되는 값·조건·반환·지역 변수·while·map과 연결된 함수를 정해진 연산 한도 안에서 계산합니다. 네트워크·화면·외부 라이브러리는 실행하지 않으며 실제 앱 테스트를 대신하지 않습니다."
          : "A restricted model evaluates supported values, conditions, returns, local bindings, while, map and imported functions within an operation budget. It does not run network calls, UI or external libraries, and does not replace application tests."}
      </p>
    </div>
  );
}
