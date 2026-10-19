import { useId, useRef, useState, useEffect } from "react";
import type { FunctionInfo, Lang, Rule, Words } from "../core/types";
import {
  displayValue,
  suggestScenarios,
  type Scenario,
  type ScenarioReport,
} from "../core/scenarioModel";
import { scenarioMarkdown, scenarioStatus } from "../core/report";
import "./scenario.css";
import { PreviewValueHelp } from "./PreviewValueHelp";

type Props = {
  fn: FunctionInfo;
  rules: Rule[];
  lang: Lang;
  revision: string;
  change?: { description: Words; newText: string };
  run: (rows: Scenario[]) => Promise<ScenarioReport>;
  exportReport: (markdown: string) => Promise<void> | void;
  disabled?: boolean;
};

export function ScenarioLab({
  fn,
  rules,
  lang,
  revision,
  change,
  run,
  exportReport,
  disabled,
}: Props) {
  const ko = lang === "ko",
    id = useId();
  const [rows, setRows] = useState(() =>
    suggestScenarios(fn, rules, change?.newText).map((r) =>
      r.args.map(inputText),
    ),
  );
  const [result, setResult] = useState<ScenarioReport>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const current = useRef(revision);
  const requestId = useRef(0);
  const resultRef = useRef<HTMLDivElement>(null);
  current.current = revision;
  useEffect(() => {
    requestId.current++;
    setResult(undefined);
    setError("");
    setBusy(false);
  }, [revision]);
  useEffect(() => {
    if (result) resultRef.current?.focus({ preventScroll: true });
  }, [result]);
  useEffect(
    () => () => {
      requestId.current++;
    },
    [],
  );
  const t = (k: string, e: string) => (ko ? k : e);
  function edit(next: string[][]) {
    requestId.current++;
    setRows(next);
    setResult(undefined);
    setError("");
    setNotice("");
    setBusy(false);
  }
  async function evaluate() {
    const token = ++requestId.current,
      version = current.current;
    setBusy(true);
    setError("");
    setResult(undefined);
    setNotice("");
    try {
      const inputs = rows.map((row, i) => ({
        label: String(i + 1),
        args: row.map((v, j) => parseInput(v, fn.params[j].type)),
      }));
      const report = await run(inputs);
      if (token === requestId.current && version === current.current)
        setResult(report);
    } catch (e) {
      if (token === requestId.current)
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (token === requestId.current) setBusy(false);
    }
  }
  return (
    <section className="scenario-lab" aria-labelledby={`${id}-title`}>
      <div className="scenario-heading">
        <div>
          <span className="eyebrow">WHAT CHANGES?</span>
          <h3 id={`${id}-title`}>
            {t("어떤 경우에 결과가 달라질까요?", "Which cases change?")}
          </h3>
        </div>
        <span className="scenario-local">
          {t("기기 안에서 계산", "Computed locally")}
        </span>
      </div>
      <p className="scenario-description">
        {change
          ? change.description[lang]
          : t(
              "입력별 결과를 확인하세요. 변경안을 만들면 전후를 비교합니다.",
              "Explore inputs. Prepare a change to compare before and after.",
            )}
      </p>
      <p className="scenario-hint">
        {t(
          "추천 입력은 시작점입니다. 실제로 중요한 사례를 더해 보세요.",
          "Suggested inputs are a starting point. Add cases that matter to you.",
        )}
      </p>
      <details open={!result} className="scenario-inputs">
        <summary>
          {t(
            `입력 사례 ${rows.length}개 편집`,
            `Edit ${rows.length} input cases`,
          )}
        </summary>
        <div className="scenario-scroll">
          <table>
            <caption className="scenario-sr">
              {t("입력 사례 편집", "Edit scenarios")} · {fn.name}
            </caption>
            <thead>
              <tr>
                <th>#</th>
                {fn.params.map((p) => (
                  <th key={p.name}>
                    {p.label?.[lang] || p.name}
                    {p.label && p.label[lang] !== p.name && (
                      <small>{p.name}</small>
                    )}
                    <small>{p.type}</small>
                  </th>
                ))}
                <th>{t("삭제", "Remove")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <th scope="row">{i + 1}</th>
                  {row.map((value, j) => (
                    <td key={j}>
                      {fn.params[j].type === "boolean" ? (
                        <select
                          aria-label={`${i + 1}: ${fn.params[j].name}`}
                          value={value}
                          onChange={(e) =>
                            edit(
                              rows.map((r, n) =>
                                n === i
                                  ? r.map((v, m) =>
                                      m === j ? e.target.value : v,
                                    )
                                  : r,
                              ),
                            )
                          }
                        >
                          <option value="false">false</option>
                          <option value="true">true</option>
                        </select>
                      ) : (
                        <input
                          aria-label={`${i + 1}: ${fn.params[j].name}`}
                          value={value}
                          inputMode={
                            fn.params[j].type === "number" ? "decimal" : "text"
                          }
                          onChange={(e) =>
                            edit(
                              rows.map((r, n) =>
                                n === i
                                  ? r.map((v, m) =>
                                      m === j ? e.target.value : v,
                                    )
                                  : r,
                              ),
                            )
                          }
                        />
                      )}
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      aria-label={t(
                        `사례 ${i + 1} 삭제`,
                        `Remove case ${i + 1}`,
                      )}
                      disabled={rows.length === 1 || busy}
                      onClick={() => edit(rows.filter((_, n) => n !== i))}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="scenario-actions">
          <button
            type="button"
            disabled={rows.length >= 12 || busy}
            onClick={() =>
              edit([
                ...rows,
                fn.params.map((p) =>
                  p.type === "boolean"
                    ? "false"
                    : p.type === "number"
                      ? "0"
                      : p.type === "string"
                        ? ""
                        : "null",
                ),
              ])
            }
          >
            {t("+ 사례 추가", "+ Add case")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              edit(
                suggestScenarios(fn, rules, change?.newText).map((r) =>
                  r.args.map(inputText),
                ),
              )
            }
          >
            {t("추천 입력", "Suggest inputs")}
          </button>
          <button
            className="scenario-primary"
            type="button"
            disabled={busy || disabled}
            onClick={() => void evaluate()}
          >
            {busy
              ? t("계산 중…", "Comparing…")
              : change
                ? t("변경 전후 비교", "Compare before & after")
                : t("전체 결과 확인", "Evaluate all")}
          </button>
        </div>
      </details>
      {error && (
        <p className="scenario-error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div
          className="scenario-results"
          ref={resultRef}
          tabIndex={-1}
          aria-label={t("입력별 계산 결과", "Results by input")}
        >
          <div className="scenario-summary" role="status">
            <strong>
              {
                result.rows.filter(
                  (r) => r.status === (change ? "changed" : "observed"),
                ).length
              }
            </strong>{" "}
            {change ? t("개 달라짐", "changed") : t("개 계산됨", "observed")}
            <span>
              · {result.rows.filter((r) => r.status === "unavailable").length}{" "}
              {t("개 확인 불가", "unavailable")} · {result.rows.length}{" "}
              {t("개 사례", "cases")}
            </span>
          </div>
          <div className="scenario-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("입력", "Inputs")}</th>
                  <th>
                    {change ? t("변경 전", "Before") : t("결과", "Result")}
                  </th>
                  {change && <th>{t("변경 후", "After")}</th>}
                  <th>{t("비교", "Status")}</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} data-status={row.status}>
                    <td>
                      <code>{displayValue(row.args)}</code>
                    </td>
                    <td>
                      <code>
                        {row.before.ok
                          ? displayValue(row.before.result)
                          : row.before.error}
                      </code>
                    </td>
                    {change && (
                      <td>
                        <code>
                          {row.after?.ok
                            ? displayValue(row.after.result)
                            : row.after?.error}
                        </code>
                      </td>
                    )}
                    <td>
                      <span className={`scenario-status ${row.status}`}>
                        {scenarioStatus(row.status, lang)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PreviewValueHelp
            values={result.rows.flatMap((row) =>
              [row.before, row.after]
                .filter((r) => r?.ok)
                .map((r) => r!.result),
            )}
            lang={lang}
          />
          <button
            type="button"
            className="scenario-export"
            onClick={async () => {
              try {
                await exportReport(scenarioMarkdown(result, lang));
                setNotice(
                  t(
                    "비교 설명서를 준비했습니다.",
                    "Comparison report prepared.",
                  ),
                );
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            {t("비교 설명서 만들기 (.md)", "Create comparison report (.md)")}
          </button>
          <p className="scenario-hint">
            {t(
              "위에 보이는 파일명·입력·출력만 담습니다. 공유 전에 확인하세요. 자동 공개하지 않습니다.",
              "Contains the displayed file name, inputs and outputs. Review before sharing. Nothing is auto-published.",
            )}
          </p>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      <p className="scenario-footnote">
        {t(
          "제한된 계산 미리보기입니다. 표시된 입력만 확인하며 실제 앱 실행·전체 테스트를 대신하지 않습니다.",
          "Limited calculation preview for these inputs only. It does not replace running or testing the app.",
        )}
      </p>
    </section>
  );
}
function inputText(value: unknown) {
  return typeof value === "string" ? value : displayValue(value);
}
function parseInput(value: string, type: string): unknown {
  if (type === "string") return value;
  if (type === "number") {
    if (!value.trim() || !Number.isFinite(Number(value)))
      throw Error("숫자를 입력해 주세요. / Enter a finite number.");
    return Number(value);
  }
  if (type === "boolean") return value === "true";
  try {
    return JSON.parse(value);
  } catch {
    throw Error(
      "배열·객체는 JSON으로 입력하세요. / Use JSON for arrays and objects.",
    );
  }
}
