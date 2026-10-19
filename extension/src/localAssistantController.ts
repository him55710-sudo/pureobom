import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import { OllamaClient, type InferenceProcessor } from "./ollama";
import { inputString } from "./protocol";
import type { AnalysisClient } from "./analysisClient";
import type {
  AssistantInput,
  AssistantProposal,
  AssistantConstraintCheck,
  AssistantObservation,
} from "../../src/core/localAssistant";
import {
  checkAssistantConstraint,
  supportsObservationInputs,
} from "../../src/core/localAssistant";
import { validatePython } from "./pythonValidation";
import type { ChangeFacts } from "../../src/core/changeFacts";

export type AssistantValidation = {
  status: "syntax-passed" | "syntax-failed" | "unavailable";
  detail: string;
  changeFacts?: ChangeFacts;
};
export type AssistantResult = Omit<AssistantProposal, "updated"> & {
  id: string;
  model: string;
  digest: string;
  elapsedMs: number;
  processor: InferenceProcessor;
  validation: AssistantValidation;
  constraint?: AssistantConstraintCheck;
  focus?: { name: string; line: number; endLine: number };
  observations?: AssistantObservation[];
};
export type ObservationView = { id: string; items: AssistantObservation[] };
type Pending = {
  result: AssistantResult;
  updated: string;
  original: string;
  doc: vscode.TextDocument;
  version: number;
  context: string;
  reviewed: boolean;
};

export class LocalAssistantController implements vscode.Disposable {
  private pending?: Pending;
  private running?: AbortController;
  private observed?: {
    view: ObservationView;
    context: string;
    version: number;
    source: string;
    focusId: string;
  };
  private previews = new Map<string, string>();
  private provider = vscode.workspace.registerTextDocumentContentProvider(
    "pureobom-local-preview",
    {
      provideTextDocumentContent: (uri) =>
        this.previews.get(uri.toString()) || "",
    },
  );
  constructor(
    private current: (context: string | undefined) => vscode.TextDocument,
    private analyzer: AnalysisClient,
    private validateGo?: (
      source: string,
      signal: AbortSignal,
    ) => Promise<AssistantValidation>,
    private validateJava?: (
      source: string,
      signal: AbortSignal,
    ) => Promise<AssistantValidation>,
    private sqlDialect?: (doc: vscode.TextDocument) => "sqlite" | undefined,
    private validateCSharp?: (
      source: string,
      signal: AbortSignal,
    ) => Promise<AssistantValidation>,
    private resolveFocus?: (
      context: string | undefined,
      id: string,
    ) => AssistantInput["focus"],
    private observeFunction?: (
      context: string | undefined,
      focus: NonNullable<AssistantInput["focus"]>,
      inputs: string,
    ) => Promise<AssistantObservation[]>,
  ) {}
  private client(processor: InferenceProcessor = "auto") {
    if (vscode.env.remoteName)
      throw Error(
        "로컬 AI는 데스크톱의 로컬 작업 공간에서 사용하세요. / Local AI requires a local desktop workspace.",
      );
    return new OllamaClient(
      vscode.workspace
        .getConfiguration("pureobom")
        .get<number>("ollamaPort", 11434),
      undefined,
      processor,
    );
  }
  async models() {
    return {
      origin: this.client().origin,
      models: await this.client().models(),
    };
  }
  cancel() {
    this.running?.abort();
  }
  invalidate() {
    this.cancel();
    this.pending = undefined;
    this.observed = undefined;
  }
  async observe(
    context: string | undefined,
    payload: Record<string, unknown>,
  ): Promise<ObservationView> {
    const doc = this.current(context);
    if (!supportsObservationInputs(doc.languageId) || !this.observeFunction)
      throw Error(
        "계산 예시는 선택한 JS/TS 기능에서 사용할 수 있습니다. / Calculation examples require a selected JS/TS function.",
      );
    const focusId = inputString(payload.focusFunctionId, 1000);
    const focus = this.focus(context, focusId, "explain")!;
    const source = doc.getText(),
      version = doc.version;
    const items = await this.observeFunction(
      context,
      focus,
      inputString(payload.inputs, 8000),
    );
    if (
      this.current(context) !== doc ||
      doc.version !== version ||
      doc.getText() !== source
    )
      throw Error(
        "파일이 바뀌었습니다. 다시 계산하세요. / Source changed. Calculate again.",
      );
    const id = randomUUID();
    this.observed = {
      view: { id, items: items.map((row) => ({ ...row })) },
      context: context!,
      version,
      source,
      focusId,
    };
    return { id, items };
  }
  private focus(context: string | undefined, id: unknown, task: unknown) {
    if (task !== "explain" || !this.resolveFocus)
      throw Error(
        "기능 선택은 설명 요청에서만 사용할 수 있습니다. / Function focus requires an explanation request.",
      );
    const focus = this.resolveFocus(context, inputString(id, 1000));
    if (!focus)
      throw Error(
        "최신 원문에서 설명할 기능을 다시 선택하세요. / Select a function from the current source.",
      );
    return focus;
  }
  async generate(
    context: string | undefined,
    payload: Record<string, unknown>,
  ): Promise<AssistantResult> {
    const doc = this.current(context);
    if (!vscode.workspace.isTrusted)
      throw Error(
        "로컬 AI를 사용하려면 작업 공간을 신뢰해야 합니다. / Local AI requires a trusted workspace.",
      );
    if (this.running)
      throw Error(
        "진행 중인 요청을 취소하거나 기다려 주세요. / Wait for or cancel the current request.",
      );
    const input: AssistantInput = {
      source: doc.getText(),
      language: doc.languageId,
      sqlDialect: this.sqlDialect?.(doc),
      instruction: inputString(payload.instruction, 2000),
      task: payload.task as AssistantInput["task"],
      lang: payload.lang as AssistantInput["lang"],
      editConstraint:
        payload.editConstraint as AssistantInput["editConstraint"],
      ...(payload.focusFunctionId !== undefined
        ? {
            focus: this.focus(context, payload.focusFunctionId, payload.task),
          }
        : {}),
    };
    if (payload.observationId !== undefined) {
      const observed = this.observed;
      if (
        input.task !== "explain" ||
        !observed ||
        observed.view.id !== payload.observationId ||
        observed.context !== context ||
        observed.version !== doc.version ||
        observed.source !== input.source ||
        observed.focusId !== payload.focusFunctionId
      )
        throw Error(
          "예시 계산이 바뀌었습니다. 선택한 기능에서 다시 계산하세요. / Calculation examples changed. Calculate again for the selected function.",
        );
      input.observations = observed.view.items.map((row) => ({ ...row }));
    }
    const version = doc.version;
    const controller = new AbortController();
    this.running = controller;
    this.pending = undefined;
    try {
      const response = await this.client(
        (payload.processor === undefined
          ? "auto"
          : payload.processor) as InferenceProcessor,
      ).generate(inputString(payload.model, 200), input, controller.signal);
      const validation: AssistantValidation = response.proposal.edits.length
        ? doc.languageId === "python"
          ? await validatePython(response.proposal.updated)
          : doc.languageId === "csharp" && this.validateCSharp
            ? await this.validateCSharp(
                response.proposal.updated,
                controller.signal,
              )
            : doc.languageId === "java" && this.validateJava
              ? await this.validateJava(
                  response.proposal.updated,
                  controller.signal,
                )
              : doc.languageId === "go" && this.validateGo
                ? await this.validateGo(
                    response.proposal.updated,
                    controller.signal,
                  )
                : await this.analyzer.call<AssistantValidation>(
                    "validateAssistant",
                    {
                      language: doc.languageId,
                      source: response.proposal.updated,
                      original: input.source,
                      sqlDialect: input.sqlDialect,
                    },
                  )
        : {
            status: "unavailable" as const,
            detail: "변경안 없음 / No proposed change",
          };
      if (
        controller.signal.aborted ||
        this.current(context) !== doc ||
        doc.version !== version ||
        doc.getText() !== input.source
      )
        throw Error(
          "파일이 바뀌었습니다. 다시 요청하세요. / The file changed. Request again.",
        );
      const { updated, ...proposal } = response.proposal;
      const result = {
        ...proposal,
        id: randomUUID(),
        model: response.model.name,
        digest: response.model.digest,
        elapsedMs: response.elapsedMs,
        processor: response.processor,
        validation,
        ...(input.observations
          ? { observations: input.observations.map((row) => ({ ...row })) }
          : {}),
        ...(input.focus
          ? {
              focus: {
                name: input.focus.name,
                line: doc.positionAt(input.focus.start).line + 1,
                endLine: doc.positionAt(input.focus.end).line + 1,
              },
            }
          : {}),
        constraint: checkAssistantConstraint(
          input.editConstraint,
          validation.changeFacts,
        ),
      };
      this.pending = {
        result,
        updated,
        original: input.source,
        doc,
        version,
        context: context!,
        reviewed: false,
      };
      return result;
    } finally {
      if (this.running === controller) this.running = undefined;
    }
  }
  private checked(id: string, context: string | undefined) {
    const doc = this.current(context),
      p = this.pending;
    if (
      !p ||
      p.result.id !== id ||
      p.context !== context ||
      p.doc !== doc ||
      p.version !== doc.version ||
      p.original !== doc.getText()
    )
      throw Error(
        "이 제안의 원본이 바뀌었습니다. 다시 요청하세요. / The proposal is stale. Request again.",
      );
    return p;
  }
  async source(id: string, context: string | undefined, index: unknown) {
    const p = this.checked(id, context);
    if (
      !Number.isInteger(index) ||
      (index as number) < 0 ||
      !p.result.citations[index as number]
    )
      throw Error("Invalid source reference");
    const citation = p.result.citations[index as number];
    const editor = await vscode.window.showTextDocument(p.doc, {
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: true,
    });
    this.checked(id, context);
    editor.selection = new vscode.Selection(
      p.doc.positionAt(citation.start),
      p.doc.positionAt(citation.end),
    );
    editor.revealRange(
      editor.selection,
      vscode.TextEditorRevealType.InCenterIfOutsideViewport,
    );
  }
  async preview(id: string, context: string | undefined) {
    const p = this.checked(id, context);
    if (!p.result.edits.length)
      throw Error("변경안이 없습니다. / No proposed change.");
    const suffix =
      p.doc.uri.path.match(/\.[a-zA-Z0-9]+$/)?.[0] ||
      (
        {
          javascript: ".js",
          javascriptreact: ".jsx",
          typescript: ".ts",
          typescriptreact: ".tsx",
          python: ".py",
          go: ".go",
          rust: ".rs",
          java: ".java",
          csharp: ".cs",
          html: ".html",
          css: ".css",
          sql: ".sql",
          json: ".json",
          jsonc: ".jsonc",
        } as Record<string, string>
      )[p.doc.languageId] ||
      ".txt";
    const before = vscode.Uri.from({
      scheme: "pureobom-local-preview",
      path: `/${id}/before${suffix}`,
    });
    const after = vscode.Uri.from({
      scheme: "pureobom-local-preview",
      path: `/${id}/after${suffix}`,
    });
    if (this.previews.size > 20) this.previews.clear();
    this.previews.set(before.toString(), p.original);
    this.previews.set(after.toString(), p.updated);
    await vscode.commands.executeCommand(
      "vscode.diff",
      before,
      after,
      "풀어봄 · 로컬 AI 변경 제안",
      { preview: true },
    );
    this.checked(id, context).reviewed = true;
    return { before: before.toString(), after: after.toString() };
  }
  async apply(
    id: string,
    context: string | undefined,
    acknowledgeUnchecked: unknown,
  ) {
    if (!vscode.workspace.isTrusted)
      throw Error(
        "작업 공간을 신뢰해야 적용할 수 있습니다. / Trust the workspace before applying.",
      );
    const p = this.checked(id, context);
    if (!p.reviewed || !p.result.edits.length)
      throw Error("먼저 코드 차이를 확인하세요. / Review the code diff first.");
    if (p.result.validation.status === "syntax-failed")
      throw Error(
        "문법 오류가 있는 제안은 적용할 수 없습니다. / A syntax-invalid proposal cannot be applied.",
      );
    if (p.result.constraint && p.result.constraint.status !== "passed")
      throw Error(
        "선택한 공백·줄바꿈 제한을 확인하지 못한 제안은 적용할 수 없습니다. / The whitespace-only constraint was not satisfied; this proposal cannot be applied.",
      );
    if (acknowledgeUnchecked !== true)
      throw Error(
        "타입·실행 결과 미검증 여부를 확인하세요. / Acknowledge that type and runtime behavior remain unchecked.",
      );
    const editor = await vscode.window.showTextDocument(p.doc, {
      viewColumn: vscode.ViewColumn.One,
      preview: false,
      preserveFocus: true,
    });
    const checked = this.checked(id, context);
    const applied = await editor.edit(
      (builder) => {
        for (const edit of checked.result.edits)
          builder.replace(
            new vscode.Range(
              checked.doc.positionAt(edit.start),
              checked.doc.positionAt(edit.end),
            ),
            edit.after,
          );
      },
      { undoStopBefore: true, undoStopAfter: true },
    );
    if (!applied)
      throw Error(
        "편집기에 적용하지 못했습니다. / The editor could not apply the proposal.",
      );
    this.pending = undefined;
    return { applied: true };
  }
  dispose() {
    this.invalidate();
    this.provider.dispose();
    this.previews.clear();
  }
}
