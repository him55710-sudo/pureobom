import { parentPort } from "node:worker_threads";
import { ProjectAnalyzer } from "../../src/core/project";
import { analyzeFile } from "../../src/core/analyze";
import { makePatch, parseRequest } from "../../src/core/edit";
import { simulate } from "../../src/core/simulate";
import { observeFunction } from "../../src/core/assistantObservations";
import { compareScenarios } from "../../src/core/scenarios";
import { validateAssistantChange } from "../../src/core/assistantValidation";
import { formatFunction } from "../../src/core/formatFunction";
import { rustSource } from "./rustParser";
const analyzer = new ProjectAnalyzer();
parentPort!.on("message", async ({ id, type, payload }) => {
  try {
    let result: unknown;
    if (type === "rust") result = await rustSource(payload.file, payload);
    else if (type === "validateAssistant" && payload.language === "rust")
      result = await rustSource(
        { path: "proposal.rs", content: payload.source },
        { action: "validate" },
      );
    else if (type === "analyze")
      result = analyzer.analyze(payload.files, payload.glossary);
    else if (type === "validateAssistant")
      result = validateAssistantChange(
        payload.language,
        payload.source,
        payload.sqlDialect,
        payload.original,
      );
    else if (type === "formatFunction")
      result = formatFunction(payload.file, payload.functionId);
    else if (type === "patch")
      result = makePatch(
        payload.file,
        payload.ruleId,
        payload.value,
        payload.glossary,
      );
    else if (type === "request") {
      const r = parseRequest(
        payload.request,
        analyzeFile(payload.file, payload.glossary).rules,
      );
      result = makePatch(payload.file, r.rule.id, r.value, payload.glossary);
    } else if (type === "compare")
      result = compareScenarios(
        payload.files,
        payload.path,
        payload.name,
        payload.scenarios,
        payload.patch,
      );
    else if (type === "observe")
      result = observeFunction(
        payload.files,
        payload.path,
        payload.focus,
        payload.inputs,
      );
    else if (type === "simulate")
      result = simulate(
        payload.files,
        payload.path,
        payload.name,
        payload.args,
      );
    else throw Error("지원하지 않는 분석 요청입니다.");
    parentPort!.postMessage({ id, result });
  } catch (error) {
    parentPort!.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
