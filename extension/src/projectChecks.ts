import * as vscode from "vscode";
import { createHash, randomUUID } from "node:crypto";
import {
  isPackageCheck,
  readPackageScript,
  type PackageScript,
} from "./packageScripts";

export type ProjectTask = {
  id: string;
  name: string;
  source: string;
  folder: string;
  kind: "process" | "shell";
  command: string;
  cwd: string;
  packageScript?: PackageScript;
};
export type ProjectCheck = {
  id: string;
  name: string;
  folder: string;
  file: string;
  sourceSha256: string;
  startedAt: string;
  elapsedMs?: number;
  status:
    | "running"
    | "stopping"
    | "passed"
    | "failed"
    | "cancelled"
    | "timeout"
    | "unknown";
  exitCode?: number;
  stale: boolean;
  staleReason?: string;
};
type Choice = {
  fingerprint: string;
  settings: string;
  uri: string;
  packageFingerprint?: string;
};
type Run = {
  id: string;
  uri: vscode.Uri;
  folder: vscode.WorkspaceFolder;
  execution?: vscode.TaskExecution;
  processStarted?: boolean;
  stopSent?: boolean;
  stop?: "cancelled" | "timeout";
  timer: ReturnType<typeof setTimeout>;
  finishing?: boolean;
};
// Generated/dependency directories are outside the change-observation scope.
export const ignoredCheckDirectories = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "target",
  ".venv",
  "venv",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  ".next",
  "coverage",
  "test-results",
]);
const hash = (value: Uint8Array | string) =>
  createHash("sha256").update(value).digest("hex");
const folderOf = (task: vscode.Task) =>
  typeof task.scope === "object" ? task.scope : undefined;
function eligible(task: vscode.Task, folder: vscode.WorkspaceFolder) {
  return (
    folderOf(task)?.uri.toString() === folder.uri.toString() &&
    !task.isBackground &&
    (task.definition.type === "npm"
      ? isPackageCheck(task.definition)
      : ["test", "build"].includes(task.group?.id || "")) &&
    (task.execution instanceof vscode.ProcessExecution ||
      task.execution instanceof vscode.ShellExecution)
  );
}
function fingerprint(task: vscode.Task) {
  // Environment values participate in change detection but never leave the host.
  const e = task.execution;
  return hash(
    JSON.stringify({
      name: task.name,
      source: task.source,
      scope: folderOf(task)?.uri.toString(),
      group: task.group?.id,
      background: task.isBackground,
      definition: task.definition,
      execution:
        e instanceof vscode.ProcessExecution
          ? { process: e.process, args: e.args, options: e.options }
          : e instanceof vscode.ShellExecution
            ? {
                command: e.command,
                commandLine: e.commandLine,
                args: e.args,
                options: e.options,
              }
            : null,
      matchers: task.problemMatchers,
    }),
  );
}
function view(task: vscode.Task, id: string): ProjectTask {
  const e = task.execution as vscode.ProcessExecution | vscode.ShellExecution;
  return {
    id,
    name: task.name,
    source: task.source,
    folder: folderOf(task)!.name,
    kind: e instanceof vscode.ProcessExecution ? "process" : "shell",
    command:
      e instanceof vscode.ProcessExecution
        ? JSON.stringify([e.process, ...e.args], null, 2)
        : e.commandLine ||
          JSON.stringify([e.command, ...(e.args || [])], null, 2),
    cwd: e.options?.cwd || folderOf(task)!.uri.fsPath,
  };
}

export function executionSettings(task: vscode.Task) {
  const platform =
    process.platform === "win32"
      ? "windows"
      : process.platform === "darwin"
        ? "osx"
        : "linux";
  const keys = new Set([
    "tasks",
    `terminal.integrated.env.${platform}`,
    "terminal.integrated.inheritEnv",
    "terminal.integrated.detectLocale",
  ]);
  if (task.definition.type === "npm")
    for (const key of [
      "npm.packageManager",
      "npm.runSilent",
      "npm.autoDetect",
      "npm.exclude",
    ])
      keys.add(key);
  if (task.execution instanceof vscode.ShellExecution) {
    for (const key of [
      "automationProfile",
      "defaultProfile",
      "profiles",
      "shell",
      "shellArgs",
    ])
      keys.add(`terminal.integrated.${key}.${platform}`);
  }
  // Include settings explicitly referenced by the task's variable expressions.
  for (const match of JSON.stringify(task.execution).matchAll(
    /\$\{config:([^}]+)\}/g,
  ))
    keys.add(match[1]);
  const config = vscode.workspace.getConfiguration(
    undefined,
    folderOf(task)?.uri,
  );
  return hash(
    JSON.stringify([...keys].sort().map((key) => [key, config.get(key)])),
  );
}

/** Runs only an explicitly selected, already configured command, never model text. */
export class ProjectChecks implements vscode.Disposable {
  readonly changes = new vscode.EventEmitter<ProjectCheck>();
  result?: ProjectCheck;
  private choices = new Map<string, Choice>();
  private active?: Run;
  private measurement?: symbol;
  private resultFolder?: vscode.WorkspaceFolder;
  private resultUri?: string;
  private resultTask?: vscode.Task;
  private resultSettings?: string;
  private disposables: vscode.Disposable[] = [];
  constructor(
    private current: (context: string | undefined) => vscode.TextDocument,
  ) {
    const watcher = vscode.workspace.createFileSystemWatcher("**/*");
    this.disposables.push(
      vscode.tasks.registerTaskProvider("pureobom-check", {
        provideTasks: () => [],
        resolveTask: (task) => (task.execution ? task : undefined),
      }),
      watcher,
      watcher.onDidChange((uri) => this.changed(uri)),
      watcher.onDidCreate((uri) => this.changed(uri)),
      watcher.onDidDelete((uri) => this.changed(uri)),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.contentChanges.length) this.changed(e.document.uri);
      }),
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.choices.clear();
        this.markStale("workspace folders changed");
      }),
      vscode.workspace.onDidChangeConfiguration(() => {
        // Linux discovers terminal profiles on first use. A configuration event
        // alone does not mean the command's effective settings changed.
        if (
          !this.resultTask ||
          executionSettings(this.resultTask) !== this.resultSettings
        ) {
          this.choices.clear();
          this.markStale("execution settings changed");
        }
      }),
      vscode.tasks.onDidEndTaskProcess((e) => {
        if (this.matches(e.execution)) void this.finish(e.exitCode);
      }),
      vscode.tasks.onDidStartTaskProcess((e) => {
        if (this.matches(e.execution)) {
          const run = this.active!;
          run.execution = e.execution;
          run.processStarted = true;
          this.stopRun(run);
        }
      }),
      vscode.tasks.onDidEndTask((e) => {
        if (this.matches(e.execution)) void this.finish(undefined);
      }),
    );
  }
  private matches(execution: vscode.TaskExecution) {
    return (
      !!this.active && execution.task.definition.pureobomRun === this.active.id
    );
  }
  private publish(next: Partial<ProjectCheck>) {
    if (!this.result) return;
    this.result = { ...this.result, ...next };
    this.changes.fire(this.result);
  }
  private markStale(staleReason: string) {
    if (this.result && !this.result.stale)
      this.publish({ stale: true, staleReason });
  }
  private changed(uri: vscode.Uri) {
    if (uri.toString() === this.resultUri) {
      this.markStale(`file changed: ${this.result?.file}`);
      return;
    }
    const folder = this.resultFolder;
    if (
      !folder ||
      vscode.workspace.getWorkspaceFolder(uri)?.uri.toString() !==
        folder.uri.toString()
    )
      return;
    const path = uri.path.slice(folder.uri.path.length).split("/");
    if (!path.some((part) => ignoredCheckDirectories.has(part)))
      this.markStale(`file changed: ${path.filter(Boolean).join("/")}`);
  }
  private context(context: string | undefined) {
    if (!vscode.workspace.isTrusted || vscode.env.remoteName)
      throw Error(
        "신뢰한 로컬 작업 공간에서 검사하세요. / Checks require a trusted local workspace.",
      );
    const doc = this.current(context),
      folder = vscode.workspace.getWorkspaceFolder(doc.uri);
    if (doc.uri.scheme !== "file" || !folder || folder.uri.scheme !== "file")
      throw Error(
        "프로젝트 폴더에 저장한 파일을 여세요. / Open a file saved in a project folder.",
      );
    return { doc, folder };
  }
  private requireSaved(folder: vscode.WorkspaceFolder) {
    if (
      vscode.workspace.textDocuments.some(
        (doc) =>
          doc.isDirty &&
          (doc.isUntitled ||
            vscode.workspace.getWorkspaceFolder(doc.uri)?.uri.toString() ===
              folder.uri.toString()),
      )
    )
      throw Error(
        "저장하지 않은 파일이 있습니다. 먼저 저장하거나 되돌려 주세요. / Save or revert unsaved files before running a project check.",
      );
  }
  async list(context: string | undefined): Promise<ProjectTask[]> {
    const { doc, folder } = this.context(context);
    const tasks = await vscode.tasks.fetchTasks();
    if (this.context(context).doc !== doc)
      throw Error("File changed. Refresh tasks.");
    if (this.choices.size > 100) this.choices.clear();
    const results = await Promise.all(
      tasks
        .filter((task) => eligible(task, folder))
        .map(async (task) => {
          const packageInfo = await readPackageScript(
            folder.uri.fsPath,
            task.definition,
          ).catch(() => undefined);
          // An npm script without its current manifest cannot be reviewed accurately.
          if (task.definition.type === "npm" && !packageInfo) return undefined;
          const id = randomUUID();
          this.choices.set(id, {
            fingerprint: fingerprint(task),
            settings: executionSettings(task),
            uri: doc.uri.toString(),
            packageFingerprint: packageInfo?.fingerprint,
          });
          return { ...view(task, id), packageScript: packageInfo?.view };
        }),
    );
    if (this.context(context).doc !== doc)
      throw Error("File changed. Refresh tasks.");
    return results.filter((task): task is NonNullable<typeof task> => !!task);
  }
  async start(context: string | undefined, id: string, reviewed: unknown) {
    if (this.active || this.measurement)
      throw Error("검사가 진행 중입니다. / A check is already running.");
    if (reviewed !== true)
      throw Error("실행할 명령을 먼저 확인하세요. / Review the command first.");
    const { selected, doc, folder, bytes } = await this.select(context, id);
    if (this.active || this.measurement)
      throw Error("A check is already running.");
    return this.execute(selected, doc, folder, bytes);
  }
  /** Resolve a previously listed task again without executing it. */
  async select(context: string | undefined, id: string) {
    const choice = this.choices.get(id),
      { doc, folder } = this.context(context);
    if (!choice || choice.uri !== doc.uri.toString())
      throw Error("검사 목록을 새로 읽으세요. / Refresh the task list.");
    this.requireSaved(folder);
    const version = doc.version;
    const tasks = await vscode.tasks.fetchTasks();
    const selected = tasks.find(
      (task) =>
        eligible(task, folder) && fingerprint(task) === choice.fingerprint,
    );
    if (!selected || executionSettings(selected) !== choice.settings)
      throw Error(
        "검사 명령이 바뀌었습니다. 목록을 새로 읽으세요. / Task configuration changed. Refresh the list.",
      );
    const packageInfo = await readPackageScript(
      folder.uri.fsPath,
      selected.definition,
    ).catch(() => undefined);
    if (
      packageInfo?.fingerprint !== choice.packageFingerprint ||
      (selected.definition.type === "npm" && !packageInfo)
    )
      throw Error(
        "검사 스크립트가 바뀌었습니다. 목록을 다시 읽고 확인하세요. / Package script changed. Reload and review the list.",
      );
    const bytes = await vscode.workspace.fs.readFile(doc.uri);
    this.confirm(context, doc, version);
    if (executionSettings(selected) !== choice.settings)
      throw Error("Task configuration changed. Refresh the list.");
    return { selected, doc, folder, bytes };
  }
  confirm(
    context: string | undefined,
    doc: vscode.TextDocument,
    version: number,
  ) {
    const current = this.context(context);
    if (current.doc !== doc || doc.version !== version)
      throw Error("File changed. Refresh tasks.");
    this.requireSaved(current.folder);
  }
  reserveMeasurement(): vscode.Disposable {
    if (this.active || this.measurement)
      throw Error(
        "검사 또는 측정이 진행 중입니다. / A check or measurement is already running.",
      );
    const token = Symbol();
    this.measurement = token;
    return {
      dispose: () => {
        if (this.measurement === token) this.measurement = undefined;
      },
    };
  }
  evidence(uri: vscode.Uri, sourceSha256: string): ProjectCheck | undefined {
    return this.resultUri === uri.toString() &&
      this.result?.sourceSha256 === sourceSha256 &&
      this.result.status === "passed" &&
      !this.result.stale
      ? { ...this.result }
      : undefined;
  }
  private async execute(
    selected: vscode.Task,
    doc: vscode.TextDocument,
    folder: vscode.WorkspaceFolder,
    bytes: Uint8Array,
  ) {
    const runId = randomUUID();
    const run: Run = {
      id: runId,
      uri: doc.uri,
      folder,
      timer: setTimeout(() => this.cancel("timeout"), 10 * 60 * 1000),
    };
    this.active = run;
    this.resultFolder = folder;
    this.resultUri = doc.uri.toString();
    this.resultTask = selected;
    this.resultSettings = executionSettings(selected);
    this.result = {
      id: runId,
      name: selected.name,
      folder: folder.name,
      file: doc.uri.path.slice(folder.uri.path.length + 1),
      sourceSha256: hash(bytes),
      startedAt: new Date().toISOString(),
      status: "running",
      stale: false,
    };
    this.changes.fire(this.result);
    // Re-create only the reviewed execution, with a unique ID. Hidden dependsOn,
    // runOn and watcher options are intentionally not copied from configuration.
    const task = new vscode.Task(
      { type: "pureobom-check", pureobomRun: runId },
      folder,
      selected.name,
      "Pureobom",
      selected.execution,
      selected.problemMatchers,
    );
    task.presentationOptions = {
      reveal: vscode.TaskRevealKind.Always,
      focus: false,
      panel: vscode.TaskPanelKind.New,
    };
    try {
      run.execution = await vscode.tasks.executeTask(task);
      this.stopRun(run);
      return { id: runId };
    } catch (error) {
      await this.finish(undefined);
      throw error;
    }
  }
  cancel(reason: "cancelled" | "timeout" = "cancelled") {
    const run = this.active;
    if (!run || run.finishing) return;
    run.stop = reason;
    this.publish({ status: "stopping" });
    this.stopRun(run);
  }
  private stopRun(run: Run) {
    // executeTask can resolve before VS Code can terminate the process. Keep
    // early cancellation pending until the actual process-start event.
    if (!run.stop || !run.processStarted || !run.execution || run.stopSent)
      return;
    run.stopSent = true;
    run.execution.terminate();
  }
  private async finish(exitCode: number | undefined) {
    const run = this.active;
    if (!run || run.finishing) return;
    run.finishing = true;
    clearTimeout(run.timer);
    try {
      const bytes = await vscode.workspace.fs.readFile(run.uri);
      if (hash(bytes) !== this.result?.sourceSha256)
        this.markStale("source disk hash changed");
      this.requireSaved(run.folder);
    } catch {
      this.markStale("source unavailable or unsaved files");
    }
    if (this.active !== run) return;
    this.publish({
      status:
        run.stop ||
        (exitCode === 0
          ? "passed"
          : exitCode === undefined
            ? "unknown"
            : "failed"),
      exitCode,
      elapsedMs: Date.now() - Date.parse(this.result!.startedAt),
    });
    this.active = undefined;
  }
  dispose() {
    if (this.active) {
      clearTimeout(this.active.timer);
      this.active.execution?.terminate();
      this.active = undefined;
    }
    this.disposables.forEach((d) => d.dispose());
    this.changes.dispose();
  }
}
