export type Lang = "ko" | "en";
export type Words = { ko: string; en: string };
export type SourceFile = {
  path: string;
  content: string;
  sqlDialect?: "sqlite";
};
export type Anchor = {
  start: number;
  end: number;
  line: number;
  endLine: number;
};
export type Step = Anchor & {
  id: string;
  kind: string;
  text: Words;
  children: Step[];
  otherwise?: Step[];
  finalizer?: Step;
  branches?: { label: Words; steps: Step[] }[];
  supported: boolean;
};
export type Rule = Anchor & {
  id: string;
  name: string;
  label: Words;
  value: string | number | boolean;
  type: "string" | "number" | "boolean" | "operator";
  scope: string;
  raw: string;
  note?: Words;
  cssProperty?: string;
  syntax?:
    | "jsxText"
    | "jsxAttribute"
    | "json"
    | "python"
    | "go"
    | "java"
    | "csharp"
    | "rust"
    | "sql"
    | "htmlText"
    | "htmlAttribute"
    | "css";
};
export type InterfaceNode = Anchor & {
  id: string;
  kind:
    | "element"
    | "component"
    | "text"
    | "value"
    | "condition"
    | "branch"
    | "iteration"
    | "attribute"
    | "fragment"
    | "unknown";
  title: Words;
  detail?: Words;
  code?: string;
  ruleId?: string;
  children: InterfaceNode[];
};
export type InterfaceStructure = {
  roots: InterfaceNode[];
  truncated: boolean;
};
export type FunctionInfo = Anchor & {
  note?: Words;
  id: string;
  name: string;
  label: Words;
  params: { name: string; type: string; optional: boolean; label?: Words }[];
  steps: Step[];
  calls: string[];
  async: boolean;
  simulatable: boolean;
};
export type Issue = Anchor & {
  id: string;
  level: "error" | "review" | "info";
  title: Words;
  detail: Words;
};
export type ImportInfo = {
  source: string;
  line: number;
  target?: string;
  external: boolean;
};
export type FileAnalysis = {
  sql?: { dialect?: "sqlite"; version: string; truncated: boolean };
  web?: { language: "html" | "css"; truncated: boolean; nodes: number };
  python?: { version: string; truncated: boolean };
  go?: { version: string; truncated: boolean };
  java?: { version: string; truncated: boolean };
  csharp?: { version: string; languageVersion: string; truncated: boolean };
  rust?: { version: string; truncated: boolean };
  data?: import("./jsonData").JsonDataFacts;
  interface?: InterfaceStructure;
  terms?: import("./glossary").CodeTerm[];
  path: string;
  kind: "script" | "json" | "text";
  lines: number;
  functions: FunctionInfo[];
  rules: Rule[];
  imports: ImportInfo[];
  issues: Issue[];
  steps: Step[];
  explained: number;
  total: number;
  syntaxValid: boolean;
};
export type ProjectAnalysis = {
  files: FileAnalysis[];
  elapsed: number;
  cacheHits: number;
};
export type Patch = {
  path: string;
  ruleId: string;
  start: number;
  end: number;
  oldText: string;
  newText: string;
  original: string;
  updated: string;
  description: Words;
  semanticChecked: false;
};
// A missing path denotes a display-only notice, not a source location.
export type Trace = {
  path?: string;
  line: number;
  text: string;
  truncated?: true;
  nonFiniteArithmetic?: true;
};
export type Simulation = {
  ok: boolean;
  result?: unknown;
  error?: string;
  trace: Trace[];
};
export const words = (ko: string, en: string): Words => ({ ko, en });
