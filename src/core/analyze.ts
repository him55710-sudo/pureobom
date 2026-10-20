import ts from "typescript";
import { label, operators, particle } from "./labels";
import { normalizeGlossary, type GlossaryEntry } from "./glossary";
import { terminology } from "./terminology";
import { analyzeInterface } from "./jsx";
import { describeJsonData } from "./jsonData";
import { readWebSource } from "./webSource";
import { readSqlSource } from "./sqlSource";
import {
  words,
  type Anchor,
  type FileAnalysis,
  type FunctionInfo,
  type Issue,
  type Lang,
  type Rule,
  type SourceFile,
  type Step,
  type Words,
} from "./types";

export function parse(file: SourceFile) {
  return ts.createSourceFile(
    file.path,
    file.content,
    ts.ScriptTarget.Latest,
    true,
    /\.tsx$/i.test(file.path)
      ? ts.ScriptKind.TSX
      : /\.jsx$/i.test(file.path)
        ? ts.ScriptKind.JSX
        : /\.[cm]?js$/i.test(file.path)
          ? ts.ScriptKind.JS
          : ts.ScriptKind.TS,
  );
}
export function diagnostics(sf: ts.SourceFile) {
  return (
    sf as ts.SourceFile & { parseDiagnostics: ts.DiagnosticWithLocation[] }
  ).parseDiagnostics;
}
export function anchor(node: ts.Node, sf: ts.SourceFile): Anchor {
  return {
    start: node.getStart(sf),
    end: node.end,
    line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
    endLine: sf.getLineAndCharacterOfPosition(node.end).line + 1,
  };
}
function hasPendingFinally(node: ts.Node): boolean {
  for (
    let parent = node.parent;
    parent && !ts.isFunctionLike(parent);
    parent = parent.parent
  ) {
    if (
      ts.isTryStatement(parent) &&
      parent.finallyBlock &&
      ((node.pos >= parent.tryBlock.pos && node.end <= parent.tryBlock.end) ||
        (parent.catchClause &&
          node.pos >= parent.catchClause.pos &&
          node.end <= parent.catchClause.end))
    )
      return true;
  }
  return false;
}
function literal(n: ts.Node): string | number | boolean | undefined {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))
    return n.text;
  if (ts.isNumericLiteral(n)) return Number(n.text);
  if (n.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (n.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (
    ts.isPrefixUnaryExpression(n) &&
    ts.isNumericLiteral(n.operand) &&
    (n.operator === ts.SyntaxKind.MinusToken ||
      n.operator === ts.SyntaxKind.PlusToken)
  )
    return (
      (n.operator === ts.SyntaxKind.MinusToken ? -1 : 1) *
      Number(n.operand.text)
    );
}
export function expression(
  n: ts.Node,
  sf: ts.SourceFile,
  lang: Lang,
  depth = 0,
  naming?: (node: ts.Node) => Words,
): string {
  const ko = lang === "ko";
  if (depth > 12)
    return ko ? "복잡한 계산식 (원문 확인)" : "complex expression (see source)";
  const e = (x: ts.Node) => expression(x, sf, lang, depth + 1, naming);
  const name = (node: ts.Identifier) => naming?.(node) || label(node.text);
  const v = literal(n);
  if (v !== undefined)
    return typeof v === "string"
      ? `“${v}”`
      : typeof v === "boolean"
        ? v
          ? ko
            ? "예"
            : "yes"
          : ko
            ? "아니요"
            : "no"
        : v.toLocaleString("en-US");
  if (n.kind === ts.SyntaxKind.NullKeyword) return ko ? "비어 있는 값" : "null";
  if (ts.isIdentifier(n)) return name(n)[lang];
  if (
    ts.isParenthesizedExpression(n) ||
    ts.isAsExpression(n) ||
    ts.isNonNullExpression(n)
  )
    return `(${e(n.expression)})`;
  if (ts.isBinaryExpression(n)) {
    const op = n.operatorToken.getText(sf),
      a = e(n.left),
      b = e(n.right);
    if (operators[op])
      return ko
        ? `${particle(a)} ${b} ${operators[op][0]}`
        : `${a} is ${operators[op][1]} ${b}`;
    const join: Record<string, [string, string]> = {
      "+": ["더하기", "plus"],
      "-": ["빼기", "minus"],
      "*": ["곱하기", "times"],
      "/": ["나누기", "divided by"],
      "%": ["나눈 나머지", "modulo"],
      "&&": ["그리고", "and"],
      "||": ["또는", "or"],
      "??": ["값이 없으면", "or, if null,"],
      "=": ["에 저장:", "assign:"],
      "**": ["거듭제곱", "to the power of"],
    };
    return join[op]
      ? `(${a} ${join[op][ko ? 0 : 1]} ${b})`
      : `${n.getText(sf)} (${ko ? "연산자 원문" : "original operator"})`;
  }
  if (
    ts.isPrefixUnaryExpression(n) &&
    n.operator === ts.SyntaxKind.ExclamationToken
  )
    return ko ? `${particle(e(n.operand))} 아님` : `not ${e(n.operand)}`;
  if (ts.isPropertyAccessExpression(n))
    return ko
      ? `${e(n.expression)}의 ${(naming?.(n.name) || label(n.name.text))[lang]}`
      : `${e(n.expression)} → ${(naming?.(n.name) || label(n.name.text))[lang]}`;
  if (ts.isElementAccessExpression(n))
    return ko
      ? `${e(n.expression)}에서 ${e(n.argumentExpression)} 위치의 값`
      : `${e(n.expression)} at ${e(n.argumentExpression)}`;
  if (ts.isCallExpression(n))
    return ko
      ? `${e(n.expression)} 기능 호출 (전달: ${n.arguments.map(e).join(", ") || "없음"})`
      : `call ${e(n.expression)} (with ${n.arguments.map(e).join(", ") || "no inputs"})`;
  if (ts.isAwaitExpression(n))
    return ko
      ? `${e(n.expression)} 결과를 기다림`
      : `wait for ${e(n.expression)}`;
  if (ts.isConditionalExpression(n))
    return ko
      ? `${e(n.condition)}이면 ${e(n.whenTrue)}, 아니면 ${e(n.whenFalse)}`
      : `if ${e(n.condition)}, ${e(n.whenTrue)}; otherwise ${e(n.whenFalse)}`;
  if (ts.isObjectLiteralExpression(n))
    return ko
      ? `묶음 데이터 { ${n.properties.map((p) => (ts.isShorthandPropertyAssignment(p) ? name(p.name)[lang] : ts.isPropertyAssignment(p) ? `${p.name.getText(sf)}: ${e(p.initializer)}` : `원문: ${p.getText(sf)}`)).join(", ")} }`
      : `record { ${n.properties.map((p) => (ts.isShorthandPropertyAssignment(p) ? name(p.name)[lang] : ts.isPropertyAssignment(p) ? `${p.name.getText(sf)}: ${e(p.initializer)}` : p.getText(sf))).join(", ")} }`;
  if (ts.isArrayLiteralExpression(n))
    return `[${n.elements.map(e).join(", ")}]`;
  if (ts.isNewExpression(n))
    return ko
      ? `${n.expression.getText(sf)} 객체 만들기 (${n.arguments?.map(e).join(", ") || ""})`
      : `create ${n.expression.getText(sf)} (${n.arguments?.map(e).join(", ") || ""})`;
  if (ts.isArrowFunction(n) || ts.isFunctionExpression(n))
    return ko
      ? "함수 값 (해당 함수의 별도 설명에서 본문 확인, 호출 시점은 호출하는 코드에 따름)"
      : "a function value (read its body in the separate function entry; the calling code determines when it runs)";
  if (
    ts.isJsxElement(n) ||
    ts.isJsxSelfClosingElement(n) ||
    ts.isJsxFragment(n)
  )
    return ko
      ? "화면 구성 요소를 만듭니다. 실제 화면은 실행 환경에 따라 달라집니다."
      : "create interface elements; rendered output depends on the runtime";
  return `${n.getText(sf).slice(0, 180)} (${ko ? "이 표현은 원문 확인이 필요함" : "this expression needs source review"})`;
}

export function analyzeFile(
  file: SourceFile,
  glossary: GlossaryEntry[] = [],
): FileAnalysis {
  const out: FileAnalysis = {
    path: file.path,
    kind: "text",
    lines: file.content.split("\n").length,
    functions: [],
    rules: [],
    imports: [],
    issues: [],
    steps: [],
    explained: 0,
    total: 0,
    syntaxValid: true,
  };
  const zero = { start: 0, end: 0, line: 1, endLine: 1 };
  if (/\.sql$/i.test(file.path)) {
    readSqlSource(file.content, file.sqlDialect, out);
    return out;
  }
  if (/\.(?:html?|css)$/i.test(file.path)) {
    readWebSource(
      file.content,
      /\.css$/i.test(file.path) ? "css" : "html",
      out,
    );
    return out;
  }
  if (/\.jsonc?$/i.test(file.path)) {
    out.kind = "json";
    try {
      const {
        facts: data,
        rules,
        steps,
      } = describeJsonData(file.content, /\.jsonc$/i.test(file.path));
      out.data = data;
      out.rules = rules;
      out.steps = [
        {
          ...zero,
          id: "json",
          kind: "data",
          text: words(
            `이 파일의 최상위 데이터는 ${data.type === "array" ? data.entries + "개 항목의 목록" : data.type === "object" ? data.entries + "개 항목의 객체" : "하나의 값"}입니다. 실행 조건이나 값의 사용 방식은 소비 코드를 확인해야 합니다.`,
            `The root is ${data.type === "array" ? "an array with " + data.entries + " entries" : data.type === "object" ? "an object with " + data.entries + " entries" : "a single value"}. Execution conditions and the use of these values depend on the consuming code.`,
          ),
          children: [],
          supported: true,
        },
      ];
      out.steps.push(...steps);
    } catch {
      out.syntaxValid = false;
      out.issues.push({
        ...zero,
        id: "json-error",
        level: "error",
        title: words("설정 파일을 읽을 수 없어요", "Invalid JSON/JSONC"),
        detail: words(
          "따옴표, 쉼표, 괄호를 확인해 주세요.",
          "Check quotes, commas and brackets.",
        ),
      });
    }
    return out;
  }
  if (!/\.[cm]?[jt]sx?$/i.test(file.path)) return out;
  out.kind = "script";
  const sf = parse(file);
  const naming = terminology(sf, normalizeGlossary(glossary));
  out.terms = naming.terms;
  const ex = (node: ts.Node, lang: Lang) =>
    expression(node, sf, lang, 0, naming.describe);
  const at = (n: ts.Node) => anchor(n, sf);
  const txt = (n: ts.Node) => words(ex(n, "ko"), ex(n, "en"));
  const ui = analyzeInterface(sf, txt);
  if (ui.structure.roots.length) out.interface = ui.structure;
  out.rules.push(...ui.rules);
  const issue = (
    n: ts.Node,
    key: string,
    title: ReturnType<typeof words>,
    detail: ReturnType<typeof words>,
    level: Issue["level"] = "review",
  ) =>
    out.issues.push({ ...at(n), id: `${key}:${n.pos}`, level, title, detail });
  for (const d of diagnostics(sf)) {
    const start = d.start || 0;
    out.issues.push({
      start,
      end: start + (d.length || 0),
      line: sf.getLineAndCharacterOfPosition(start).line + 1,
      endLine: sf.getLineAndCharacterOfPosition(start).line + 1,
      id: `syntax:${start}`,
      level: "error",
      title: words("코드 문법을 확인해 주세요", "Syntax needs attention"),
      detail: words(
        ts.flattenDiagnosticMessageText(d.messageText, " "),
        ts.flattenDiagnosticMessageText(d.messageText, " "),
      ),
    });
  }
  out.syntaxValid = diagnostics(sf).length === 0;
  function scope(n: ts.Node) {
    let p = n.parent;
    while (p) {
      if (ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p))
        return p.name?.getText(sf) || "function";
      if (ts.isArrowFunction(p) || ts.isFunctionExpression(p))
        return ts.isVariableDeclaration(p.parent)
          ? p.parent.name.getText(sf)
          : `function@${at(p).line}`;
      p = p.parent;
    }
    return "file";
  }
  function rule(
    n: ts.Node,
    name: string,
    title = label(name),
    typeOverride?: Rule["type"],
  ) {
    const value = typeOverride === "operator" ? n.getText(sf) : literal(n);
    if (value === undefined) return;
    out.rules.push({
      ...at(n),
      id: `${file.path}:${n.getStart(sf)}`,
      name,
      label: title,
      value,
      type: typeOverride || (typeof value as Rule["type"]),
      scope: scope(n),
      raw: n.getText(sf),
    });
  }
  function step(s: ts.Statement): Step {
    const base: Step = {
      ...at(s),
      id: `step:${s.getStart(sf)}`,
      kind: "other",
      text: words(
        "이 구문은 원문을 함께 확인해 주세요.",
        "Review the source for this statement.",
      ),
      children: [],
      supported: true,
    };
    const block = (n: ts.Statement) =>
      ts.isBlock(n) ? Array.from(n.statements).map(step) : [step(n)];
    if (ts.isVariableStatement(s)) {
      base.kind = "value";
      const ds = s.declarationList.declarations;
      base.text = words(
        ds
          .map(
            (d) =>
              `${naming.describe(d.name).ko}에 ${d.initializer ? ex(d.initializer, "ko") : "아직 정해지지 않은 값"}을(를) 담습니다.`,
          )
          .join(" "),
        ds
          .map(
            (d) =>
              `Store ${d.initializer ? ex(d.initializer, "en") : "an undefined value"} in ${naming.describe(d.name).en}.`,
          )
          .join(" "),
      );
    } else if (ts.isIfStatement(s)) {
      base.kind = "condition";
      const t = txt(s.expression);
      base.text = words(`이 조건을 만족하면: ${t.ko}`, `If ${t.en}`);
      base.children = block(s.thenStatement);
      if (s.elseStatement) base.otherwise = block(s.elseStatement);
    } else if (ts.isReturnStatement(s)) {
      base.kind = "return";
      base.text = hasPendingFinally(s)
        ? words(
            s.expression
              ? `${particle(txt(s.expression).ko, "object")} 반환하려고 합니다. 이 블록을 나가기 전에 주변 finally 단계를 먼저 거칩니다.`
              : "값 없이 반환하려고 합니다. 이 블록을 나가기 전에 주변 finally 단계를 먼저 거칩니다.",
            s.expression
              ? `Prepare to return ${txt(s.expression).en}; run the enclosing finally steps before leaving.`
              : "Prepare to return without a value; run the enclosing finally steps before leaving.",
          )
        : s.expression
          ? words(
              `${particle(txt(s.expression).ko, "object")} 결과로 돌려주고 이 기능을 끝냅니다.`,
              `Return ${txt(s.expression).en} and finish this function.`,
            )
          : words(
              "값 없이 이 기능을 끝냅니다.",
              "Finish this function without a value.",
            );
    } else if (ts.isThrowStatement(s)) {
      base.kind = "error";
      base.text = words(
        `${txt(s.expression).ko}: 오류를 발생시키고 현재 흐름을 중단합니다.`,
        `Raise ${txt(s.expression).en} and interrupt the current flow.`,
      );
    } else if (ts.isExpressionStatement(s)) {
      base.kind = "action";
      base.text = txt(s.expression);
    } else if (ts.isForOfStatement(s)) {
      base.kind = "loop";
      base.text = words(
        `${txt(s.expression).ko}의 항목을 하나씩 ${s.initializer.getText(sf)}에 넣고 반복합니다.`,
        `For each item in ${txt(s.expression).en}, bind ${s.initializer.getText(sf)} and repeat.`,
      );
      base.children = block(s.statement);
    } else if (ts.isForInStatement(s)) {
      base.kind = "loop";
      base.text = words(
        `${txt(s.expression).ko}의 열거 가능한 속성 이름을 순서대로 확인합니다.`,
        `Iterate enumerable property names of ${txt(s.expression).en}.`,
      );
      base.children = block(s.statement);
    } else if (ts.isWhileStatement(s) || ts.isDoStatement(s)) {
      base.kind = "loop";
      base.text = words(
        `${ts.isDoStatement(s) ? "먼저 한 번 실행한 다음, " : ""}${txt(s.expression).ko}인 동안 반복합니다.`,
        `${ts.isDoStatement(s) ? "Run once, then repeat" : "Repeat"} while ${txt(s.expression).en}.`,
      );
      base.children = block(s.statement);
    } else if (ts.isForStatement(s)) {
      base.kind = "loop";
      base.text = words(
        `반복 준비: ${s.initializer?.getText(sf) || "없음"} · 계속할 조건: ${s.condition ? txt(s.condition).ko : "항상"} · 매회 마무리: ${s.incrementor?.getText(sf) || "없음"}`,
        `Repeat: initialize ${s.initializer?.getText(sf) || "none"}; while ${s.condition ? txt(s.condition).en : "true"}; update ${s.incrementor?.getText(sf) || "none"}.`,
      );
      base.children = block(s.statement);
    } else if (ts.isTryStatement(s)) {
      base.kind = "guard";
      base.text = s.catchClause
        ? words(
            "먼저 시도합니다. 오류가 이 try 블록으로 전달되면 아래 오류 처리로 넘어갑니다.",
            "Try these steps; if an error reaches this try block, enter the catch branch below.",
          )
        : words(
            "먼저 시도합니다. 이 블록에는 catch 오류 처리가 없습니다.",
            "Try these steps. This block has no catch handler.",
          );
      base.children = s.tryBlock.statements.map(step);
      if (s.catchClause)
        base.otherwise = s.catchClause.block.statements.map(step);
      if (s.finallyBlock)
        base.finalizer = {
          ...at(s.finallyBlock),
          id: `finally:${s.pos}`,
          kind: "finally",
          text: words(
            "마지막 정리 (finally): try 또는 오류 처리 단계를 벗어날 때 실행합니다. 여기서 반환하거나 오류를 던지면 앞선 반환값·오류를 바꿀 수 있습니다.",
            "Finally: run when leaving the try or catch steps. A return or throw here can replace the earlier return value or error.",
          ),
          children: s.finallyBlock.statements.map(step),
          supported: true,
        };
    } else if (ts.isBlock(s)) {
      base.kind = "group";
      base.text = words(
        "다음 단계를 순서대로 실행합니다.",
        "Run these steps in order.",
      );
      base.children = s.statements.map(step);
    } else if (ts.isFunctionDeclaration(s)) {
      base.kind = "definition";
      base.text = words(
        `${naming.describe(s.name, "익명 기능").ko} 기능을 정의합니다. 호출될 때 실행됩니다.`,
        `Define ${naming.describe(s.name, "an anonymous function").en}; it runs when called.`,
      );
    } else if (ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s)) {
      base.kind = "type";
      base.text = words(
        `${s.name.text}: 데이터가 어떤 모양이어야 하는지 정합니다. 실행 중에 입력을 검증하는 코드는 아닙니다.`,
        `${s.name.text}: describes the shape of data; this does not validate inputs at runtime.`,
      );
    } else if (ts.isClassDeclaration(s)) {
      base.kind = "class";
      base.text = words(
        `${s.name?.text || "이름 없는 클래스"}: 데이터와 관련 기능을 묶는 설계도입니다. 메서드는 아래에서 각각 확인할 수 있습니다.`,
        `${s.name?.text || "Anonymous class"} groups data and methods; inspect each method below.`,
      );
    } else if (ts.isImportDeclaration(s) || ts.isExportDeclaration(s)) {
      base.kind = "link";
      base.text = words(
        `다른 파일과 기능을 연결합니다: ${s.getText(sf)}`,
        `Connect modules: ${s.getText(sf)}`,
      );
    } else {
      base.supported = false;
      base.text = words(
        `${ts.SyntaxKind[s.kind]} 구문입니다. 자동 설명이 지원되지 않아 원문 확인이 필요합니다.`,
        `Unsupported ${ts.SyntaxKind[s.kind]} statement; inspect the source.`,
      );
    }
    out.total++;
    if (base.supported) out.explained++;
    return base;
  }
  function visit(n: ts.Node) {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier))
      out.imports.push({
        source: n.moduleSpecifier.text,
        line: at(n).line,
        external: !n.moduleSpecifier.text.startsWith("."),
      });
    if (
      ts.isExportDeclaration(n) &&
      n.moduleSpecifier &&
      ts.isStringLiteral(n.moduleSpecifier)
    )
      out.imports.push({
        source: n.moduleSpecifier.text,
        line: at(n).line,
        external: !n.moduleSpecifier.text.startsWith("."),
      });
    if (ts.isVariableDeclaration(n) && n.initializer) {
      rule(n.initializer, n.name.getText(sf), naming.describe(n.name));
      if (
        /(api.?key|password|secret|access.?token)/i.test(n.name.getText(sf)) &&
        typeof literal(n.initializer) === "string" &&
        String(literal(n.initializer)).length > 3
      )
        issue(
          n,
          "secret",
          words(
            "비밀값이 코드에 들어 있는지 확인하세요",
            "Check for embedded secrets",
          ),
          words(
            "이름과 문자열 형태로 탐지한 후보입니다. 실제 비밀값이면 환경 설정으로 분리하고 노출 여부를 점검하세요.",
            "A name-and-literal heuristic flagged this value. If it is a real secret, move it to environment configuration and review exposure.",
          ),
        );
    }
    if (ts.isPropertyAssignment(n)) rule(n.initializer, n.name.getText(sf));
    if (ts.isBinaryExpression(n) && operators[n.operatorToken.getText(sf)]) {
      rule(
        n.operatorToken,
        `condition@${at(n).line}`,
        words(
          `${ex(n.left, "ko")} 비교 방식`,
          `${ex(n.left, "en")} comparison`,
        ),
        "operator",
      );
      rule(
        n.right,
        `threshold@${at(n).line}`,
        words(
          `${ex(n.left, "ko")} 비교값`,
          `${ex(n.left, "en")} comparison value`,
        ),
      );
      if (["==", "!="].includes(n.operatorToken.getText(sf)))
        issue(
          n,
          "loose",
          words(
            "서로 다른 종류의 값도 같아질 수 있어요",
            "Different value types may compare equal",
          ),
          words(
            '예를 들어 숫자 0과 문자열 "0"이 같게 처리됩니다. 원하는 비교인지 확인하세요.',
            'For example, 0 and "0" compare equal. Check whether type coercion is intended.',
          ),
        );
    }
    if (ts.isCallExpression(n)) {
      const name = n.expression.getText(sf);
      if (name === "fetch") {
        let p: ts.Node | undefined = n.parent;
        let caught = false;
        while (p && !ts.isFunctionLike(p)) {
          if (
            ts.isTryStatement(p) &&
            n.pos >= p.tryBlock.pos &&
            n.end <= p.tryBlock.end &&
            p.catchClause
          )
            caught = true;
          p = p.parent;
        }
        if (!caught)
          issue(
            n,
            "network",
            words(
              "요청 실패를 어디에서 처리하나요?",
              "Where is a failed request handled?",
            ),
            words(
              "이 호출을 감싼 try/catch가 보이지 않습니다. 호출한 쪽이나 .catch에서 처리할 수도 있으므로 연결된 흐름을 확인하세요.",
              "No enclosing try/catch was found. The caller or a .catch chain may handle failure; check the connected flow.",
            ),
          );
      }
      if (name === "eval" || name === "Function")
        issue(
          n,
          "dynamic",
          words(
            "문자열을 코드로 실행하는 부분이 있어요",
            "This may execute strings as code",
          ),
          words(
            "입력값이 들어오는 경로와 실행 필요성을 검토하세요. 이 도구의 미리보기에서는 실행하지 않습니다.",
            "Review the input path and whether dynamic execution is necessary. This tool never runs it in a preview.",
          ),
        );
    }
    if (
      (ts.isFunctionDeclaration(n) ||
        ts.isFunctionExpression(n) ||
        ts.isArrowFunction(n) ||
        ts.isMethodDeclaration(n)) &&
      n.body
    ) {
      const name =
        n.name?.getText(sf) ||
        (ts.isVariableDeclaration(n.parent)
          ? n.parent.name.getText(sf)
          : `function@${at(n).line}`);
      const calls = new Set<string>();
      function scan(x: ts.Node) {
        if (x !== n && ts.isFunctionLike(x)) return;
        if (ts.isCallExpression(x)) calls.add(x.expression.getText(sf));
        ts.forEachChild(x, scan);
      }
      scan(n.body);
      const steps = ts.isBlock(n.body)
        ? n.body.statements.map(step)
        : [
            {
              ...at(n.body),
              id: `expr:${n.body.pos}`,
              kind: "return",
              text: words(
                `${particle(txt(n.body).ko, "object")} 결과로 돌려줍니다.`,
                `Return ${txt(n.body).en}.`,
              ),
              children: [],
              supported: true,
            },
          ];
      const fn: FunctionInfo = {
        ...at(n),
        id: `fn:${n.getStart(sf)}`,
        name,
        label:
          !n.name && !ts.isVariableDeclaration(n.parent)
            ? words("이름 없는 함수", "Anonymous function")
            : naming.describe(
                n.name ||
                  (ts.isVariableDeclaration(n.parent)
                    ? n.parent.name
                    : undefined),
                name,
              ),
        params: n.parameters.map((p) => ({
          name: p.name.getText(sf),
          label: naming.describe(p.name),
          type: p.type?.getText(sf) || "unknown",
          optional: !!p.questionToken || !!p.initializer,
        })),
        steps,
        calls: [...calls],
        async: !!n.modifiers?.some(
          (m) => m.kind === ts.SyntaxKind.AsyncKeyword,
        ),
        simulatable: !ts.isMethodDeclaration(n) && !ui.contains(n.body),
      };
      out.functions.push(fn);
    }
    ts.forEachChild(n, visit);
  }
  sf.statements.forEach((s) => out.steps.push(step(s)));
  visit(sf);
  return out;
}
export function normalizePath(path: string) {
  const parts: string[] = [];
  for (const p of path.replaceAll("\\", "/").split("/")) {
    if (p === "..") parts.pop();
    else if (p && p !== ".") parts.push(p);
  }
  return parts.join("/");
}
export function resolveImport(
  from: string,
  source: string,
  paths: Set<string>,
) {
  if (!source.startsWith(".")) return undefined;
  const base = normalizePath(
    from.split("/").slice(0, -1).join("/") + "/" + source,
  );
  const stems = [base];
  if (/\.[cm]?jsx?$/.test(base)) stems.push(base.replace(/\.[cm]?jsx?$/, ""));
  for (const b of stems) {
    for (const p of [
      b,
      ...[
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".mts",
        ".mjs",
        ".cts",
        ".cjs",
        ".json",
      ].map((x) => b + x),
      ...[".ts", ".tsx", ".js", ".jsx"].map((x) => b + "/index" + x),
    ])
      if (paths.has(p)) return p;
  }
  return undefined;
}
export function linkFiles(files: FileAnalysis[]) {
  const paths = new Set(files.map((f) => f.path));
  return files.map((f) => ({
    ...f,
    imports: f.imports.map((i) => ({
      ...i,
      target: resolveImport(f.path, i.source, paths),
    })),
  }));
}
