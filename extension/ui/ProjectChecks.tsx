import { useEffect, useRef, useState } from "react";
import type { Lang } from "../../src/core/types";
import type { ViewState } from "../src/protocol";
import type { ProjectCheck, ProjectTask } from "../src/projectChecks";
import { request } from "./bridge";
import { Benchmarks } from "./Benchmarks";

export function ProjectChecks({
  state,
  lang,
}: {
  state: ViewState;
  lang: Lang;
}) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const [choices, setChoices] = useState<{
    uriContext: string;
    tasks: ProjectTask[];
  }>();
  const [selected, setSelected] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const activeContext = useRef(state.contextId);
  activeContext.current = state.contextId;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const tasks = choices?.uriContext === state.contextId ? choices.tasks : [];
  const task = tasks.find((item) => item.id === selected);
  const result = state.projectCheck;
  const comparison = state.checkComparison;
  const baseline = comparison?.baseline;
  const running = result?.status === "running" || result?.status === "stopping";
  async function act(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const statuses: Record<ProjectCheck["status"], string> = {
    running: t("명령 실행 중", "Command running"),
    stopping: t("중단 요청됨 · 종료 대기", "Stop requested · waiting for exit"),
    passed: t("명령 정상 종료", "Command exited successfully"),
    failed: t("명령 실패", "Command failed"),
    cancelled: t("취소됨", "Cancelled"),
    timeout: t("10분 제한으로 중단", "Stopped at the 10-minute limit"),
    unknown: t("종료 코드 확인 불가", "Exit code unavailable"),
  };
  const comparisonLabels = {
    "no-baseline": t(
      "기준 결과를 보관한 뒤 코드를 수정하고 같은 검사를 다시 실행하세요.",
      "Keep a baseline, edit your code, then run the same check again.",
    ),
    "awaiting-run": t(
      "기준 결과를 보관했습니다. 다음 검사 결과를 기다립니다.",
      "Baseline kept. Waiting for another check.",
    ),
    incomplete: t(
      "비교 대기 · 새 검사의 정상 종료 또는 실패가 확인되어야 합니다.",
      "Waiting for a completed check with a known exit code.",
    ),
    stale: t(
      "비교 불가 · 새 검사 이후 파일이나 설정이 바뀌었습니다. 다시 검사하세요.",
      "Cannot compare: files or settings changed after the new check started. Run again.",
    ),
    "different-command": t(
      "비교 불가 · 파일·프로젝트·명령·설정·package.json 중 하나가 다릅니다.",
      "Cannot compare: file, project, command, settings or package.json differs.",
    ),
    "passed-to-failed": t(
      "정상 종료 → 실패 · 수정 후 검사 실패를 확인하세요.",
      "Successful exit → failure. Review the new failure.",
    ),
    "failed-to-passed": t(
      "실패 → 정상 종료 · 선택한 명령이 이제 정상 종료합니다.",
      "Failure → successful exit. The selected command now exits successfully.",
    ),
    "both-passed": t(
      "두 번 모두 정상 종료 · 동작이 같다는 증명은 아닙니다.",
      "Both exited successfully. This does not prove equivalent behavior.",
    ),
    "both-failed": t(
      "두 번 모두 실패 · 같은 원인인지 로그를 비교하세요.",
      "Both failed. Compare logs to determine whether the cause is the same.",
    ),
  };
  return (
    <section className="card project-checks">
      <h2>{t("실제 프로젝트 검사", "Run a project check")}</h2>
      <p>
        {t(
          "프로젝트의 검사 명령을 확인하고 실행합니다. 등록한 test/build 작업과 VS Code가 발견한 test·build·check·typecheck·lint 스크립트를 읽습니다. AI 연결 없이 사용할 수 있으며 수정한 파일은 먼저 저장하세요.",
          "Review project checks: registered test/build tasks and test, build, check, typecheck or lint scripts discovered by VS Code. No AI connection is required. Save your changes first.",
        )}
      </p>
      <button
        disabled={busy || state.busy || !state.trusted || running}
        onClick={() =>
          void act(async () => {
            const context = state.contextId;
            const next = await request<ProjectTask[]>(
              "projectTasks",
              {},
              context,
            );
            if (mounted.current && activeContext.current === context) {
              setChoices({ uriContext: context, tasks: next });
              setSelected(next[0]?.id || "");
              setReviewed(false);
            }
          })
        }
      >
        {t("검사 목록 읽기", "Load project checks")}
      </button>
      {choices?.uriContext === state.contextId && !tasks.length ? (
        <p className="banner">
          {t(
            "표시할 검사 명령이 없습니다. package.json의 검사 스크립트를 쓰려면 VS Code의 npm 스크립트 자동 검색과 필요한 패키지 관리자를 확인하세요. 다른 명령은 .vscode/tasks.json에 group이 test 또는 build인 일회성 process/shell 작업으로 등록할 수 있습니다.",
            "No check found. For package.json scripts, check VS Code npm script auto-detection and your package manager. Other commands can be registered as one-shot process/shell tasks with group test or build in .vscode/tasks.json.",
          )}
        </p>
      ) : null}
      {tasks.length ? (
        <label>
          {t("실행할 검사", "Check to run")}
          <select
            value={selected}
            disabled={busy || running}
            onChange={(e) => {
              setSelected(e.target.value);
              setReviewed(false);
            }}
          >
            {tasks.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.folder}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {task ? (
        <>
          <p className="muted">
            {task.source} · {task.kind} · {task.cwd}
          </p>
          <pre>{task.command}</pre>
          {task.packageScript && (
            <div className="package-script-review">
              <h3>
                {t(
                  "프로젝트에 적힌 스크립트",
                  "Script declared in the project",
                )}
              </h3>
              <p>
                {task.packageScript.file} · {task.packageScript.name}
              </p>
              <pre>{task.packageScript.command}</pre>
              {(task.packageScript.before !== undefined ||
                task.packageScript.after !== undefined) && (
                <>
                  <p>
                    {t(
                      "함께 선언된 앞·뒤 스크립트입니다. 실행 여부는 패키지 관리자와 설정에 따릅니다.",
                      "Related pre/post scripts are declared below. Whether they run depends on your package manager and settings.",
                    )}
                  </p>
                  {task.packageScript.before !== undefined && (
                    <pre>{`pre${task.packageScript.name}: ${task.packageScript.before}`}</pre>
                  )}
                  {task.packageScript.after !== undefined && (
                    <pre>{`post${task.packageScript.name}: ${task.packageScript.after}`}</pre>
                  )}
                </>
              )}
              <p className="muted">
                {t(
                  "검토 후 스크립트가 바뀌면 목록을 다시 읽어야 합니다. 한 번 실행하고 종료하는 검사를 선택하세요.",
                  "Reload the list if the script changes after review. Choose a check that runs once and exits.",
                )}
              </p>
            </div>
          )}
          <p>
            {t(
              "표시한 명령 한 개만 실행합니다. dependsOn 선행 작업은 포함하지 않습니다. 필요한 준비 단계는 이 명령에 포함하세요. 실행 로그는 VS Code 터미널에서 확인합니다.",
              "Runs this single command. Task dependsOn prerequisites are not included; put required preparation in the command. Read its output in the VS Code terminal.",
            )}
          </p>
          <label className="local-ack">
            <input
              type="checkbox"
              checked={reviewed}
              disabled={busy || running}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            {t(
              "이 명령과 프로젝트 코드를 실행하는 것을 확인했습니다.",
              "I have reviewed this command and the project code it runs.",
            )}
          </label>
          <button
            className="primary"
            disabled={
              busy ||
              running ||
              !reviewed ||
              state.busy ||
              state.dirty ||
              !state.trusted
            }
            onClick={() =>
              void act(async () => {
                await request(
                  "projectRun",
                  { id: task.id, reviewed },
                  state.contextId,
                );
              })
            }
          >
            {t("저장된 프로젝트로 실행", "Run against saved project")}
          </button>
          {state.dirty ? (
            <p className="banner">
              {t(
                "현재 파일을 먼저 저장하거나 되돌려 주세요.",
                "Save or revert the current file first.",
              )}
            </p>
          ) : null}
        </>
      ) : null}
      {error ? (
        <p role="alert" className="banner error">
          {error}
        </p>
      ) : null}
      {result ? (
        <div className="project-check-result" role="status">
          <h3>{statuses[result.status]}</h3>
          <p>
            {result.name} · {result.folder}/{result.file}
          </p>
          <p>
            {new Date(result.startedAt).toLocaleString(
              lang === "ko" ? "ko-KR" : "en-US",
            )}
            {result.elapsedMs !== undefined
              ? ` · ${(result.elapsedMs / 1000).toFixed(1)}s`
              : ""}
            {result.exitCode !== undefined ? ` · exit ${result.exitCode}` : ""}
          </p>
          {result.stale ? (
            <p className="banner">
              {t(
                "검사 시작 후 파일·설정 변경이 감지됐습니다. 현재 코드의 결과로 사용할 수 없습니다. 다시 검사하세요.",
                "Files or settings changed after this check started. This result does not verify the current code. Run again.",
              )}
            </p>
          ) : null}
          <details>
            <summary>
              {t("검사를 시작한 파일의 기록", "File recorded at start")}
            </summary>
            <p className="muted">SHA-256: {result.sourceSha256}</p>
          </details>
          {running ? (
            <button
              disabled={result.status === "stopping"}
              onClick={() =>
                void act(async () => {
                  await request("projectCancel");
                })
              }
            >
              {t("검사 중단", "Stop check")}
            </button>
          ) : null}
          <button
            disabled={
              busy ||
              running ||
              state.busy ||
              state.dirty ||
              !state.trusted ||
              result.stale ||
              !["passed", "failed"].includes(result.status) ||
              result.exitCode === undefined ||
              baseline?.id === result.id
            }
            onClick={() =>
              void act(async () => {
                await request(
                  "projectBaseline",
                  { id: result.id },
                  state.contextId,
                );
              })
            }
          >
            {baseline
              ? t(
                  "이 결과를 새 기준으로 보관",
                  "Use this result as the new baseline",
                )
              : t("수정 전 기준으로 보관", "Keep as baseline before editing")}
          </button>
          <p className="muted">
            {t(
              "종료 코드만 기록합니다. 테스트 개수·성능 향상·전체 정확성을 판정하지 않습니다. 변경 감지는 VS Code가 관찰하는 프로젝트 파일에 한정되며 의존성·생성 폴더는 제외합니다.",
              "Records the exit code, not test counts, speedups or overall correctness. Change detection covers project files observed by VS Code, excluding dependency and generated folders.",
            )}
          </p>
        </div>
      ) : null}
      <div className="project-check-result check-comparison">
        <h3>
          {t("수정 전후 검사 비교", "Compare checks before and after editing")}
        </h3>
        <p role="status">
          {comparisonLabels[comparison?.outcome || "no-baseline"]}
        </p>
        {baseline && (
          <>
            <p>
              <strong>{t("보관한 기준", "Saved baseline")}</strong> ·{" "}
              {baseline.name} · {baseline.folder}/{baseline.file}
            </p>
            <p>
              {statuses[baseline.status]} · exit {baseline.exitCode} ·{" "}
              {new Date(baseline.startedAt).toLocaleString(
                lang === "ko" ? "ko-KR" : "en-US",
              )}
            </p>
            {comparison?.sourceChanged !== undefined && (
              <p>
                {comparison.sourceChanged
                  ? t(
                      "검사를 시작한 현재 파일의 바이트가 기준과 다릅니다.",
                      "The file bytes recorded at the start differ from the baseline.",
                    )
                  : t(
                      "검사를 시작한 현재 파일의 바이트는 기준과 같습니다. 다른 프로젝트 파일의 동일성을 뜻하지 않습니다.",
                      "The file bytes recorded at the start match the baseline. Other project files may differ.",
                    )}
              </p>
            )}
            <details>
              <summary>{t("기준 파일 기록", "Baseline file record")}</summary>
              <p className="muted">SHA-256: {baseline.sourceSha256}</p>
            </details>
            <button
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await request("projectBaselineClear");
                })
              }
            >
              {t("기준 지우기", "Clear baseline")}
            </button>
            <p className="muted">
              {t(
                "이 기준은 현재 세션에만 보관하는 과거 기록입니다. 현재 코드의 통과 증거로 사용하지 않습니다. 비교는 명령의 종료 결과이며 테스트 범위·동작 동일성·성능은 별도로 검증해야 합니다.",
                "This historical baseline lasts for this session and does not verify the current code. Comparison covers command exit results; test coverage, equivalent behavior and performance need separate verification.",
              )}
            </p>
          </>
        )}
      </div>
      <Benchmarks state={state} lang={lang} task={task} />
    </section>
  );
}
