import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import type {
  Patch,
  ProjectAnalysis,
  Simulation,
  SourceFile,
  Lang,
  FileAnalysis,
} from "../../src/core/types";
import { parseRequest } from "../../src/core/ruleRequest";
import { pythonSource } from "./pythonSource";
import { goSource } from "./goSource";
import { javaSource } from "./javaSource";
import { csharpSource } from "./csharpSource";
import {
  normalizeGlossary,
  updateGlossary,
  type GlossaryEntry,
} from "../../src/core/glossary";
import { AnalysisClient } from "./analysisClient";
import { editorDiagnostics } from "../../src/core/editorDiagnostics";
import type { Scenario, ScenarioReport } from "../../src/core/scenarioModel";
import { assistantLanguages } from "../../src/core/localAssistant";
import { LocalAssistantController } from "./localAssistantController";
import { ProjectChecks } from "./projectChecks";
import { Benchmarks } from "./benchmarks";
import { inputString, type PatchSummary, type ViewState } from "./protocol";
import type { FormatSummary, SimulationView } from "./protocol";
import type { FunctionFormatResult } from "../../src/core/formatFunction";

const FILE_BYTES = 512 * 1024,
  TOTAL_BYTES = 8 * 1024 * 1024;
const LANGS = new Set(Object.keys(assistantLanguages));
type PendingPatch = {
  patch: Patch;
  uri: vscode.Uri;
  version: number;
  contextId: string;
  reviewRequired?: boolean;
  reviewed?: boolean;
};
export class Controller implements vscode.Disposable {
  readonly assistant: LocalAssistantController;
  readonly checks: ProjectChecks;
  readonly benchmarks: Benchmarks;
  readonly changes = new vscode.EventEmitter<ViewState>();
  state: ViewState = {
    contextId: "",
    path: "",
    version: 0,
    dirty: false,
    trusted: vscode.workspace.isTrusted,
    busy: false,
  };
  private active?: vscode.TextDocument;
  private sources = new Map<string, { uri: vscode.Uri; file: SourceFile }>();
  private patches = new Map<string, PendingPatch>();
  private previews = new Map<string, string>();
  private simulation?: {
    id: string;
    contextId: string;
    trace: Simulation["trace"];
    sources: Map<string, { uri: vscode.Uri; content: string }>;
  };
  private epoch = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private registration: vscode.Disposable;
  private diagnosticRegistration: vscode.Disposable;
  private glossary: GlossaryEntry[] = [];
  private pythonWork?: AbortController;
  private goWork?: AbortController;
  private javaWork?: AbortController;
  private csharpWork?: AbortController;
  private sqlDialects = new WeakMap<vscode.TextDocument, "sqlite">();
  constructor(
    private client: AnalysisClient,
    private storage?: vscode.Memento,
    private pythonScript?: string,
    private goRuntime?: { script: string; cache: string },
    private javaRuntime?: { script: string; cache: string },
    private csharpRuntime?: { script: string; cache: string },
  ) {
    this.assistant = new LocalAssistantController(
      (context) => this.current(context),
      client,
      async (source, signal) => {
        try {
          const analysis = (await this.readGo(
            { path: "proposal.go", content: source },
            { action: "analyze" },
            signal,
          )) as FileAnalysis;
          return {
            status: analysis.syntaxValid ? "syntax-passed" : "syntax-failed",
            detail: analysis.syntaxValid
              ? `${analysis.go!.version}: Go 문법 파싱 통과. 타입·범위·동작·성능은 미검증입니다. / Go syntax parsed; types, ranges, behavior and performance unchecked.`
              : analysis.issues.map((i) => i.detail.en).join("\n"),
          };
        } catch (error) {
          return { status: "unavailable", detail: message(error) };
        }
      },
      async (source, signal) => {
        try {
          const analysis = (await this.readJava(
            { path: "Proposal.java", content: source },
            { action: "analyze" },
            signal,
          )) as FileAnalysis;
          return {
            status: analysis.syntaxValid ? "syntax-passed" : "syntax-failed",
            detail: analysis.syntaxValid
              ? `${analysis.java!.version}: Java 문법 파싱 통과. 타입·의존성·동작·성능은 미검증입니다. / Java syntax parsed; types, dependencies, behavior and performance unchecked.`
              : analysis.issues.map((i) => i.detail.en).join("\n"),
          };
        } catch (error) {
          return { status: "unavailable", detail: message(error) };
        }
      },
      (doc) => this.sqlDialects.get(doc),
      async (source, signal) => {
        try {
          const analysis = (await this.readCSharp(
            { path: "Proposal.cs", content: source },
            { action: "analyze" },
            signal,
          )) as FileAnalysis;
          return {
            status: analysis.syntaxValid ? "syntax-passed" : "syntax-failed",
            detail: analysis.syntaxValid
              ? `${analysis.csharp!.version}: C# 문법 파싱 통과. 타입·의존성·동작·성능은 미검증입니다. / C# syntax parsed; types, dependencies, behavior and performance unchecked.`
              : analysis.issues.map((i) => i.detail.en).join("\n"),
          };
        } catch (error) {
          return { status: "unavailable", detail: message(error) };
        }
      },
      (context, id) => {
        this.current(context);
        const fn = this.state.analysis!.functions.find((f) => f.id === id);
        if (!fn) return undefined;
        return { name: fn.name.slice(0, 400), start: fn.start, end: fn.end };
      },
    );
    this.checks = new ProjectChecks((context) => this.current(context));
    this.checks.changes.event((projectCheck) => this.publish({ projectCheck }));
    this.benchmarks = new Benchmarks(this.checks);
    this.benchmarks.changes.event((benchmark) => this.publish({ benchmark }));
    try {
      this.glossary = normalizeGlossary(storage?.get("pureobom.glossary.v1"));
    } catch {
      console.warn("Pureobom: ignored invalid local terminology data.");
    }
    this.registration = vscode.workspace.registerTextDocumentContentProvider(
      "pureobom-preview",
      {
        provideTextDocumentContent: (uri) =>
          this.previews.get(uri.toString()) ?? "",
      },
    );
    this.diagnosticRegistration = vscode.languages.onDidChangeDiagnostics(
      (event) => {
        if (
          this.active &&
          !this.active.isClosed &&
          event.uris.some(
            (uri) => uri.toString() === this.active!.uri.toString(),
          )
        )
          this.readDiagnostics();
      },
    );
  }
  private readDiagnostics() {
    if (!this.active || this.active.isClosed) return;
    this.publish({
      diagnostics: editorDiagnostics(
        vscode.languages.getDiagnostics(this.active.uri),
        this.active.version,
        randomUUID(),
      ),
    });
  }
  async diagnosticSource(
    contextId: string | undefined,
    revision: string,
    id: string,
  ) {
    const doc = this.current(contextId),
      snapshot = this.state.diagnostics;
    if (
      !snapshot ||
      snapshot.revision !== revision ||
      snapshot.status === "edited" ||
      snapshot.version !== doc.version
    )
      throw Error(
        "알림이나 코드가 바뀌었습니다. 최신 알림에서 다시 선택해 주세요. / The report or code changed. Select the latest report.",
      );
    const item = snapshot.items.find((problem) => problem.id === id);
    if (!item)
      throw Error("현재 알림에 없는 항목입니다. / Report no longer available.");
    const range = doc.validateRange(
      new vscode.Range(
        item.line - 1,
        item.column - 1,
        item.endLine - 1,
        item.endColumn - 1,
      ),
    );
    const editor = await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: true,
    });
    // Showing an editor can yield to edits or a newer diagnostic event.
    this.current(contextId);
    if (
      this.state.diagnostics?.revision !== revision ||
      doc.version !== snapshot.version
    )
      throw Error(
        "알림이 바뀌었습니다. 다시 선택해 주세요. / The report changed. Select it again.",
      );
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(
      range,
      vscode.TextEditorRevealType.InCenterIfOutsideViewport,
    );
  }
  static accepts(doc: vscode.TextDocument) {
    return (
      ["file", "untitled", "vscode-remote"].includes(doc.uri.scheme) &&
      LANGS.has(doc.languageId)
    );
  }
  isActive(doc: vscode.TextDocument) {
    return this.active?.uri.toString() === doc.uri.toString();
  }
  private path(doc: vscode.TextDocument) {
    return this.pathFor(doc.uri, doc.languageId);
  }
  private pathFor(uri: vscode.Uri, languageId?: string) {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (folder) {
      const index =
        vscode.workspace.workspaceFolders?.findIndex(
          (f) => f.uri.toString() === folder.uri.toString(),
        ) ?? 0;
      return `workspace-${index + 1}/${uri.path.slice(folder.uri.path.length).replace(/^\//, "")}`;
    }
    if (uri.scheme === "untitled")
      return `untitled/${uri.path}.${({ typescript: "ts", typescriptreact: "tsx", javascript: "js", javascriptreact: "jsx", json: "json", jsonc: "jsonc", python: "py", go: "go", java: "java", csharp: "cs", rust: "rs", html: "html", css: "css", sql: "sql" } as Record<string, string>)[languageId || ""] || "txt"}`;
    return uri.path;
  }
  private publish(next: Partial<ViewState>) {
    this.state = { ...this.state, tab: undefined, ...next };
    this.changes.fire(this.state);
  }
  private analysisGlossary() {
    const paths = new Map(
      [...this.sources.values()].map((source) => [
        source.uri.toString(),
        source.file.path,
      ]),
    );
    return this.glossary.flatMap((entry) => {
      const path = paths.get(entry.path);
      return path ? [{ ...entry, path }] : [];
    });
  }
  async setTerm(
    contextId: string | undefined,
    symbolId: string,
    lang: Lang,
    label: string,
  ) {
    const doc = this.current(contextId);
    if (
      (lang !== "ko" && lang !== "en") ||
      !this.state.analysis!.terms?.some((term) => term.id === symbolId)
    )
      throw Error(
        "현재 파일의 용어를 선택해 주세요. / Select a term in the current file.",
      );
    const previous = this.glossary;
    this.glossary = updateGlossary(
      previous,
      doc.uri.toString(),
      symbolId,
      lang,
      label,
    );
    this.invalidate();
    try {
      // Untitled document names can be reused in later sessions; never persist them.
      await this.storage?.update(
        "pureobom.glossary.v1",
        this.glossary.filter((entry) => !entry.path.startsWith("untitled:")),
      );
    } catch (error) {
      this.glossary = previous;
      await this.refresh();
      throw error;
    }
    await this.refresh();
  }
  private invalidate() {
    this.pythonWork?.abort();
    this.goWork?.abort();
    this.javaWork?.abort();
    this.csharpWork?.abort();
    this.assistant.invalidate();
    this.epoch++;
    this.patches.clear();
    this.simulation = undefined;
    this.publish({
      contextId: randomUUID(),
      busy: true,
      error: undefined,
      trusted: vscode.workspace.isTrusted,
    });
  }
  async setDocument(doc: vscode.TextDocument) {
    if (!Controller.accepts(doc)) return;
    const changedDocument = !this.isActive(doc);
    this.active = doc;
    this.publish({
      path: vscode.workspace.asRelativePath(doc.uri),
      version: doc.version,
      dirty: doc.isDirty,
      language: doc.languageId,
      sourceBytes: Buffer.byteLength(doc.getText(), "utf8"),
      analysis: undefined,
      pythonNotice: undefined,
      goNotice: undefined,
      javaNotice: undefined,
      csharpNotice: undefined,
      rustNotice: undefined,
      diagnostics: changedDocument
        ? undefined
        : this.state.diagnostics &&
            this.state.diagnostics.version !== doc.version
          ? { ...this.state.diagnostics, status: "edited" }
          : this.state.diagnostics,
    });
    if (changedDocument || !this.state.diagnostics) this.readDiagnostics();
    await this.refresh();
  }
  clearDocument() {
    this.invalidate();
    this.active = undefined;
    this.publish({
      path: "",
      language: undefined,
      sourceBytes: undefined,
      analysis: undefined,
      pythonNotice: undefined,
      goNotice: undefined,
      javaNotice: undefined,
      csharpNotice: undefined,
      rustNotice: undefined,
      diagnostics: undefined,
      busy: false,
      dirty: false,
      version: 0,
    });
  }
  openAssistant() {
    this.publish({ tab: "local" });
  }
  documentChanged(doc: vscode.TextDocument) {
    if (
      !this.active ||
      (doc.uri.toString() !== this.active.uri.toString() &&
        ![...this.sources.values()].some(
          (s) => s.uri.toString() === doc.uri.toString(),
        ))
    )
      return;
    if (
      this.isActive(doc) &&
      this.state.diagnostics &&
      this.state.diagnostics.version !== doc.version
    )
      this.publish({
        diagnostics: { ...this.state.diagnostics, status: "edited" },
      });
    this.invalidate();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.refresh(), 300);
  }
  async refresh() {
    clearTimeout(this.timer);
    if (!this.active || this.active.isClosed) {
      this.publish({ busy: false, diagnostics: undefined });
      return;
    }
    this.invalidate();
    const epoch = this.epoch,
      doc = this.active,
      path = this.path(doc);
    try {
      const content = doc.getText();
      if (Buffer.byteLength(content, "utf8") > FILE_BYTES)
        throw Error(
          "파일당 512KB까지 설명할 수 있습니다. 작은 파일로 나누어 주세요.",
        );
      if (!this.sources.has(path) && this.sources.size >= 300)
        this.sources.delete(this.sources.keys().next().value!);
      this.sources.set(path, {
        uri: doc.uri,
        file: { path, content, sqlDialect: this.sqlDialects.get(doc) },
      });
      // Open documents are authoritative, including unsaved editor changes.
      for (const source of this.sources.values()) {
        const open = vscode.workspace.textDocuments.find(
          (d) => !d.isClosed && d.uri.toString() === source.uri.toString(),
        );
        if (open) source.file = { ...source.file, content: open.getText() };
      }
      let bytes = 0;
      for (const [key, source] of this.sources) {
        const size = Buffer.byteLength(source.file.content, "utf8");
        if (
          key !== path &&
          (size > FILE_BYTES ||
            bytes + size > TOTAL_BYTES - Buffer.byteLength(content, "utf8"))
        )
          this.sources.delete(key);
        else if (key !== path) bytes += size;
      }
      const project = await this.client.call<ProjectAnalysis>("analyze", {
        files: [...this.sources.values()].map((s) => s.file),
        glossary: this.analysisGlossary(),
      });
      if (epoch !== this.epoch || doc !== this.active || doc.isClosed) return;
      let pythonNotice: string | undefined;
      let goNotice: string | undefined;
      let javaNotice: string | undefined;
      let csharpNotice: string | undefined;
      let rustNotice: string | undefined;
      if (doc.languageId === "python") {
        try {
          const analysis = (await this.readPython(
            { path, content },
            { action: "analyze" },
          )) as FileAnalysis;
          project.files = project.files.map((f) =>
            f.path === path ? analysis : f,
          );
        } catch (error) {
          pythonNotice = message(error);
        }
      }
      if (doc.languageId === "go") {
        try {
          const analysis = (await this.readGo(
            { path, content },
            { action: "analyze" },
          )) as FileAnalysis;
          project.files = project.files.map((f) =>
            f.path === path ? analysis : f,
          );
        } catch (error) {
          goNotice = message(error);
        }
      }
      if (doc.languageId === "java") {
        try {
          const analysis = (await this.readJava(
            { path, content },
            { action: "analyze" },
          )) as FileAnalysis;
          project.files = project.files.map((f) =>
            f.path === path ? analysis : f,
          );
        } catch (error) {
          javaNotice = message(error);
        }
      }
      if (doc.languageId === "csharp") {
        try {
          const analysis = (await this.readCSharp(
            { path, content },
            { action: "analyze" },
          )) as FileAnalysis;
          project.files = project.files.map((f) =>
            f.path === path ? analysis : f,
          );
        } catch (error) {
          csharpNotice = message(error);
        }
      }
      if (doc.languageId === "rust") {
        try {
          const analysis = await this.client.call<FileAnalysis>("rust", {
            file: { path, content },
            action: "analyze",
          });
          project.files = project.files.map((f) =>
            f.path === path ? analysis : f,
          );
        } catch (error) {
          rustNotice = message(error);
        }
      }
      if (epoch !== this.epoch || doc !== this.active || doc.isClosed) return;
      this.publish({
        project,
        analysis: project.files.find((f) => f.path === path),
        busy: false,
        version: doc.version,
        dirty: doc.isDirty,
        language: doc.languageId,
        sourceBytes: Buffer.byteLength(doc.getText(), "utf8"),
        pythonNotice,
        goNotice,
        javaNotice,
        csharpNotice,
        rustNotice,
      });
    } catch (e) {
      if (epoch === this.epoch)
        this.publish({ busy: false, analysis: undefined, error: message(e) });
    }
  }
  async scan() {
    if (!vscode.workspace.workspaceFolders?.length)
      throw Error("VS Code에서 프로젝트 폴더를 먼저 열어 주세요.");
    this.publish({ scanNote: "작업 공간의 연결을 읽고 있습니다…" });
    const uris = await vscode.workspace.findFiles(
      "**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts,json,jsonc}",
      "**/{node_modules,.git,.next,.vscode,dist,build,coverage,vendor,pnpm-lock.yaml,package-lock.json,yarn.lock}/**",
      301,
    );
    const next = new Map<string, { uri: vscode.Uri; file: SourceFile }>();
    let total = 0,
      skipped = 0;
    for (const uri of uris.slice(0, 300)) {
      const folder = vscode.workspace.getWorkspaceFolder(uri);
      const localPath = folder
        ? uri.path.slice(folder.uri.path.replace(/\/$/, "").length + 1)
        : undefined;
      // Only exclude hidden entries inside the selected project. A hidden
      // ancestor (for example .codex/worktrees) is not project content.
      if (
        !localPath ||
        /(?:^|\/)(?:\.[^/]+|package-lock\.json)(?:\/|$)/.test(localPath)
      ) {
        skipped++;
        continue;
      }
      try {
        const open = vscode.workspace.textDocuments.find(
          (d) => !d.isClosed && d.uri.toString() === uri.toString(),
        );
        let content: string;
        if (open) content = open.getText();
        else {
          const stat = await vscode.workspace.fs.stat(uri);
          if (stat.size > FILE_BYTES) {
            skipped++;
            continue;
          }
          content = Buffer.from(
            await vscode.workspace.fs.readFile(uri),
          ).toString("utf8");
        }
        const size = Buffer.byteLength(content, "utf8");
        if (size > FILE_BYTES || total + size > TOTAL_BYTES) {
          skipped++;
          continue;
        }
        total += size;
        const path = this.pathFor(uri);
        next.set(path, { uri, file: { path, content } });
      } catch {
        skipped++;
      }
    }
    this.sources = next;
    this.publish({
      scanNote: `${next.size}개 파일을 읽었습니다. ${skipped}개 제외${uris.length > 300 ? " · 300개 한도에 도달해 일부 파일은 생략했습니다" : ""}. 최대 8MB.`,
      tab: "map",
    });
    if (!this.active && next.size) {
      const first = next.values().next().value!;
      this.active = await vscode.workspace.openTextDocument(first.uri);
      this.publish({ path: vscode.workspace.asRelativePath(first.uri) });
      this.readDiagnostics();
    }
    await this.refresh();
  }
  private current(contextId: string | undefined) {
    const doc = this.active;
    if (
      !doc ||
      doc.isClosed ||
      !contextId ||
      contextId !== this.state.contextId ||
      this.state.busy ||
      !this.state.analysis ||
      doc.version !== this.state.version
    )
      throw Error("파일이 바뀌었습니다. 최신 설명에서 다시 시도해 주세요.");
    return doc;
  }
  private async readPython(
    file: SourceFile,
    action:
      | { action: "analyze" }
      | { action: "patch"; ruleId: string; value: string },
  ) {
    if (vscode.env.remoteName || !this.pythonScript)
      throw Error(
        "Python 구문 읽기는 데스크톱 로컬 작업 공간에서 사용하세요. / Python syntax reading requires a local desktop workspace.",
      );
    this.pythonWork?.abort();
    const run = new AbortController();
    this.pythonWork = run;
    try {
      return await pythonSource(file, this.pythonScript, action, {
        executable: vscode.workspace
          .getConfiguration("pureobom")
          .get<string>("analysisPython", ""),
        signal: run.signal,
      });
    } finally {
      if (this.pythonWork === run) this.pythonWork = undefined;
    }
  }
  private async readGo(
    file: SourceFile,
    action:
      | { action: "analyze" }
      | { action: "patch"; ruleId: string; value: string },
    signal?: AbortSignal,
  ) {
    if (vscode.env.remoteName || !this.goRuntime)
      throw Error(
        "Go 읽기는 데스크톱 로컬 작업 공간에서 사용하세요. / Go reading requires a local desktop workspace.",
      );
    if (signal?.aborted) throw Error("Go work cancelled");
    this.goWork?.abort();
    const run = new AbortController();
    this.goWork = run;
    const cancel = () => run.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      return await goSource(
        file,
        this.goRuntime.script,
        this.goRuntime.cache,
        action,
        {
          executable: vscode.workspace
            .getConfiguration("pureobom")
            .get<string>("analysisGo", ""),
          signal: run.signal,
        },
      );
    } finally {
      signal?.removeEventListener("abort", cancel);
      if (this.goWork === run) this.goWork = undefined;
    }
  }
  private async readJava(
    file: SourceFile,
    action:
      | { action: "analyze" }
      | { action: "patch"; ruleId: string; value: string },
    signal?: AbortSignal,
  ) {
    if (vscode.env.remoteName || !this.javaRuntime)
      throw Error(
        "Java 읽기는 데스크톱 로컬 작업 공간에서 사용하세요. / Java reading requires a local desktop workspace.",
      );
    if (signal?.aborted) throw Error("Java work cancelled");
    this.javaWork?.abort();
    const run = new AbortController();
    this.javaWork = run;
    const cancel = () => run.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      return await javaSource(
        file,
        this.javaRuntime.script,
        this.javaRuntime.cache,
        action,
        {
          javaHome: vscode.workspace
            .getConfiguration("pureobom")
            .get<string>("analysisJavaHome", ""),
          signal: run.signal,
        },
      );
    } finally {
      signal?.removeEventListener("abort", cancel);
      if (this.javaWork === run) this.javaWork = undefined;
    }
  }
  private async readCSharp(
    file: SourceFile,
    action:
      | { action: "analyze" }
      | { action: "patch"; ruleId: string; value: string },
    signal?: AbortSignal,
  ) {
    if (vscode.env.remoteName || !this.csharpRuntime)
      throw Error(
        "C# 읽기는 데스크톱 로컬 작업 공간에서 사용하세요. / C# reading requires a local desktop workspace.",
      );
    if (signal?.aborted) throw Error("C# work cancelled");
    this.csharpWork?.abort();
    const run = new AbortController();
    this.csharpWork = run;
    const cancel = () => run.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      return await csharpSource(
        file,
        this.csharpRuntime.script,
        this.csharpRuntime.cache,
        action,
        {
          dotnet: vscode.workspace
            .getConfiguration("pureobom")
            .get<string>("analysisDotnet", ""),
          signal: run.signal,
        },
      );
    } finally {
      signal?.removeEventListener("abort", cancel);
      if (this.csharpWork === run) this.csharpWork = undefined;
    }
  }
  async setSqlDialect(contextId: string | undefined, dialect: unknown) {
    const doc = this.current(contextId);
    if (doc.languageId !== "sql" || (dialect !== "sqlite" && dialect !== ""))
      throw Error("Invalid SQL dialect selection");
    if (dialect === "sqlite") this.sqlDialects.set(doc, "sqlite");
    else this.sqlDialects.delete(doc);
    await this.refresh();
  }
  async prepare(
    contextId: string | undefined,
    payload: Record<string, unknown>,
  ): Promise<PatchSummary> {
    const doc = this.current(contextId);
    if (!vscode.workspace.isTrusted)
      throw Error("코드를 변경하려면 작업 공간을 신뢰해야 합니다.");
    const file = {
        path: this.path(doc),
        content: doc.getText(),
        sqlDialect: this.sqlDialects.get(doc),
      },
      version = doc.version;
    let patch: Patch;
    if (["python", "go", "java", "csharp", "rust"].includes(doc.languageId)) {
      const selected =
        payload.request !== undefined
          ? parseRequest(
              inputString(payload.request),
              this.state.analysis!.rules,
            )
          : {
              rule: { id: inputString(payload.ruleId) },
              value: inputString(payload.value),
            };
      patch =
        doc.languageId === "rust"
          ? await this.client.call<Patch>("rust", {
              file,
              action: "patch",
              ruleId: selected.rule.id,
              value: selected.value,
            })
          : ((await (
              doc.languageId === "csharp"
                ? this.readCSharp.bind(this)
                : doc.languageId === "java"
                  ? this.readJava.bind(this)
                  : doc.languageId === "go"
                    ? this.readGo.bind(this)
                    : this.readPython.bind(this)
            )(file, {
              action: "patch",
              ruleId: selected.rule.id,
              value: selected.value,
            })) as Patch);
    } else
      patch =
        payload.request !== undefined
          ? await this.client.call<Patch>("request", {
              file,
              request: inputString(payload.request),
              glossary: this.analysisGlossary(),
            })
          : await this.client.call<Patch>("patch", {
              file,
              ruleId: inputString(payload.ruleId),
              value: inputString(payload.value),
              glossary: this.analysisGlossary(),
            });
    if (
      this.current(contextId) !== doc ||
      doc.version !== version ||
      doc.getText() !== patch.original
    )
      throw Error(
        "변경안을 만드는 동안 파일이 바뀌었습니다. 다시 시도해 주세요.",
      );
    const id = randomUUID();
    this.patches.clear();
    this.patches.set(id, {
      patch,
      uri: doc.uri,
      version,
      contextId: contextId!,
    });
    return {
      id,
      description: patch.description,
      oldText: patch.oldText,
      newText: patch.newText,
    };
  }
  async prepareFormat(
    contextId: string | undefined,
    functionId: string,
  ): Promise<FormatSummary> {
    const doc = this.current(contextId);
    if (!vscode.workspace.isTrusted)
      throw Error("코드를 변경하려면 작업 공간을 신뢰해야 합니다.");
    if (
      ![
        "javascript",
        "javascriptreact",
        "typescript",
        "typescriptreact",
      ].includes(doc.languageId)
    )
      throw Error("Only JS/TS functions are supported.");
    const original = doc.getText(),
      version = doc.version;
    const result = await this.client.call<FunctionFormatResult>(
      "formatFunction",
      {
        file: { path: this.path(doc), content: original },
        functionId,
      },
    );
    if (
      this.current(contextId) !== doc ||
      doc.version !== version ||
      doc.getText() !== original
    )
      throw Error(
        "파일이 바뀌었습니다. 다시 시도해 주세요. / The file changed; try again.",
      );
    this.patches.clear();
    if (!result.patch)
      return { unchanged: true, description: result.description };
    const id = randomUUID(),
      patch = result.patch;
    this.patches.set(id, {
      patch,
      uri: doc.uri,
      version,
      contextId: contextId!,
      reviewRequired: true,
    });
    return {
      id,
      kind: "function-format",
      description: patch.description,
      oldText: patch.oldText,
      newText: patch.newText,
    };
  }
  private pending(id: string, contextId: string | undefined) {
    const doc = this.current(contextId),
      pending = this.patches.get(id);
    if (
      !pending ||
      pending.contextId !== contextId ||
      pending.uri.toString() !== doc.uri.toString() ||
      pending.version !== doc.version ||
      pending.patch.original !== doc.getText()
    )
      throw Error(
        "미리보기 이후 파일이 바뀌었습니다. 변경안을 다시 만들어 주세요.",
      );
    return { doc, ...pending };
  }
  async preview(id: string, contextId: string | undefined, lang: Lang = "ko") {
    const pending = this.pending(id, contextId);
    const suffix =
      this.path(pending.doc).match(/\.[a-zA-Z0-9]+$/)?.[0] || ".txt";
    const before = vscode.Uri.from({
      scheme: "pureobom-preview",
      path: `/${id}/before${suffix}`,
    });
    const after = vscode.Uri.from({
      scheme: "pureobom-preview",
      path: `/${id}/after${suffix}`,
    });
    if (this.previews.size > 20) this.previews.clear();
    this.previews.set(before.toString(), pending.patch.original);
    this.previews.set(after.toString(), pending.patch.updated);
    await vscode.commands.executeCommand(
      "vscode.diff",
      before,
      after,
      `풀어봄 · ${pending.patch.description[lang]}`,
      { preview: true },
    );
    this.pending(id, contextId);
    this.patches.get(id)!.reviewed = true;
    return { before: before.toString(), after: after.toString() };
  }
  async apply(id: string, contextId: string | undefined) {
    if (!vscode.workspace.isTrusted)
      throw Error("코드를 변경하려면 작업 공간을 신뢰해야 합니다.");
    const pending = this.pending(id, contextId);
    if (pending.reviewRequired && !pending.reviewed)
      throw Error(
        "먼저 코드 차이를 확인해 주세요. / Preview the code diff first.",
      );
    const editor = await vscode.window.showTextDocument(pending.doc, {
      preview: false,
      preserveFocus: true,
      viewColumn: vscode.ViewColumn.One,
    });
    // Recheck after showTextDocument: no asynchronous gap before editor.edit.
    const checked = this.pending(id, contextId);
    const patch = checked.patch;
    const success = await editor.edit(
      (builder) =>
        builder.replace(
          new vscode.Range(
            checked.doc.positionAt(patch.start),
            checked.doc.positionAt(patch.end),
          ),
          patch.newText,
        ),
      { undoStopBefore: true, undoStopAfter: true },
    );
    if (!success)
      throw Error(
        "VS Code에서 변경을 적용하지 못했습니다. 파일 권한을 확인해 주세요.",
      );
    this.patches.clear();
    await this.refresh();
    return { applied: true };
  }
  async source(contextId: string | undefined, line: unknown) {
    const doc = this.current(contextId);
    if (
      !Number.isInteger(line) ||
      Number(line) < 1 ||
      Number(line) > doc.lineCount
    )
      throw Error("줄 번호가 올바르지 않습니다.");
    const position = new vscode.Position(Number(line) - 1, 0);
    const editor = await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.One,
      preview: false,
    });
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(
      new vscode.Range(position, position),
      vscode.TextEditorRevealType.InCenterIfOutsideViewport,
    );
  }
  async select(path: string) {
    const source = this.sources.get(path);
    if (!source)
      throw Error("연결 지도에 없는 파일입니다. 지도를 새로 읽어 주세요.");
    const doc = await vscode.workspace.openTextDocument(source.uri);
    await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.One,
      preview: false,
      preserveFocus: true,
    });
    await this.setDocument(doc);
  }
  async traceSource(
    contextId: string | undefined,
    traceId: unknown,
    index: unknown,
  ) {
    this.current(contextId);
    const snapshot = this.simulation;
    if (
      !snapshot ||
      snapshot.id !== traceId ||
      snapshot.contextId !== contextId ||
      !Number.isInteger(index) ||
      Number(index) < 0
    )
      throw Error(
        "계산 기록이 바뀌었습니다. 다시 계산해 주세요. / Calculation changed. Evaluate again.",
      );
    const step = snapshot.trace[Number(index)];
    const source = step?.path ? snapshot.sources.get(step.path) : undefined;
    if (!source)
      throw Error(
        "이 항목에는 원본 위치가 없습니다. / No source location for this entry.",
      );
    const doc = await vscode.workspace.openTextDocument(source.uri);
    this.current(contextId);
    if (this.simulation !== snapshot || doc.getText() !== source.content)
      throw Error(
        "계산에 사용한 코드가 바뀌었습니다. 다시 읽고 계산해 주세요. / Calculation source changed. Refresh and evaluate again.",
      );
    if (
      !Number.isInteger(step.line) ||
      step.line < 1 ||
      step.line > doc.lineCount
    )
      throw Error(
        "원본 위치를 확인할 수 없습니다. / Source location unavailable.",
      );
    const editor = await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.One,
      preview: false,
      preserveFocus: true,
    });
    // Opening the target can legitimately switch the active document/context.
    // Recheck the exact text before selecting a line after this asynchronous step.
    if (doc.isClosed || doc.getText() !== source.content)
      throw Error(
        "계산에 사용한 코드가 바뀌었습니다. 다시 계산해 주세요. / Calculation source changed. Evaluate again.",
      );
    const position = new vscode.Position(step.line - 1, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(
      new vscode.Range(position, position),
      vscode.TextEditorRevealType.InCenterIfOutsideViewport,
    );
  }
  async simulate(
    contextId: string | undefined,
    name: string,
    input: string,
  ): Promise<SimulationView> {
    const doc = this.current(contextId);
    const args: unknown = JSON.parse(input);
    if (!Array.isArray(args) || args.length > 20)
      throw Error("입력값을 JSON 배열로 적어 주세요. 예: [50000]");
    if (!this.state.analysis!.functions.some((f) => f.name === name))
      throw Error("현재 파일에 없는 기능입니다.");
    const sources = new Map(
      [...this.sources].map(([path, source]) => [
        path,
        {
          uri: source.uri,
          content: source.file.content,
        },
      ]),
    );
    const result = await this.client.call<Simulation>("simulate", {
      files: [...sources].map(([path, source]) => ({
        path,
        content: source.content,
      })),
      path: this.path(doc),
      name,
      args,
    });
    this.current(contextId);
    const traceId = randomUUID();
    this.simulation = {
      id: traceId,
      contextId: contextId!,
      trace: result.trace.map((step) => ({ ...step })),
      sources,
    };
    return { ...result, traceId };
  }
  async compare(
    contextId: string | undefined,
    name: string,
    scenarios: Scenario[],
    patchId?: string,
  ): Promise<ScenarioReport> {
    const doc = this.current(contextId);
    if (!this.state.analysis!.functions.some((f) => f.name === name))
      throw Error("현재 파일에 없는 기능입니다. / Function not in this file.");
    const patch = patchId ? this.pending(patchId, contextId).patch : undefined;
    const report = await this.client.call<ScenarioReport>("compare", {
      files: [...this.sources.values()].map((s) => s.file),
      path: this.path(doc),
      name,
      scenarios,
      patch,
    });
    this.current(contextId);
    if (patchId) this.pending(patchId, contextId);
    return report;
  }
  dispose() {
    this.pythonWork?.abort();
    this.goWork?.abort();
    this.javaWork?.abort();
    this.csharpWork?.abort();
    this.benchmarks.dispose();
    this.checks.dispose();
    this.assistant.dispose();
    clearTimeout(this.timer);
    this.registration.dispose();
    this.diagnosticRegistration.dispose();
    this.changes.dispose();
    this.client.dispose();
  }
}
export function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
