import ts from "typescript";
import { diagnostics, parse, resolveImport } from "./analyze";
import type { Simulation, SourceFile, Trace } from "./types";
import { displayValue, encodePreviewMessage } from "./previewValues";

// A deliberately small interpreter. Uploaded code never reaches eval, Function, DOM or network APIs.
export function simulate(
  files: SourceFile[],
  path: string,
  functionName: string,
  args: unknown[],
): Simulation {
  const trace: Trace[] = [];
  let budget = 4000,
    depth = 0;
  const parsed = new Map<string, ts.SourceFile>();
  const paths = new Set(files.map((f) => f.path));
  const tick = () => {
    if (--budget < 0)
      throw Error(
        "미리보기 계산 한도를 넘었습니다. / Preview budget exceeded.",
      );
  };
  const get = (p: string) => {
    let sf = parsed.get(p);
    if (!sf) {
      const f = files.find((x) => x.path === p);
      if (!f) throw Error(`파일을 찾을 수 없습니다: ${p}`);
      sf = parse(f);
      if (diagnostics(sf).length) throw Error("문법 오류가 있는 파일입니다.");
      parsed.set(p, sf);
      // Reject module initialization we cannot model instead of silently skipping side effects.
      for (const s of sf.statements) {
        if (ts.isVariableStatement(s)) {
          if (!(s.declarationList.flags & ts.NodeFlags.Const))
            throw Error(
              "변경 가능한 전역 값은 미리보기에서 지원하지 않습니다. / Mutable module state is unsupported.",
            );
          const check = (n: ts.Node) => {
            if (ts.isFunctionLike(n)) return;
            if (
              ts.isCallExpression(n) ||
              ts.isNewExpression(n) ||
              ts.isAwaitExpression(n)
            )
              throw Error(
                "파일 초기화 중 실행되는 기능은 미리보기에서 지원하지 않습니다. / Module initializer execution is unsupported.",
              );
            ts.forEachChild(n, check);
          };
          s.declarationList.declarations.forEach((d) => {
            if (d.initializer) check(d.initializer);
          });
        } else if (ts.isImportDeclaration(s)) {
          if (s.importClause?.isTypeOnly) continue;
          if (!ts.isStringLiteral(s.moduleSpecifier))
            throw Error("알 수 없는 연결입니다.");
          const target = resolveImport(
            sf.fileName,
            s.moduleSpecifier.text,
            paths,
          );
          if (!target)
            throw Error(
              "외부 모듈의 초기화는 미리보기에서 지원하지 않습니다. / External module initialization is unsupported.",
            );
          get(target);
        } else if (
          !(
            ts.isFunctionDeclaration(s) ||
            ts.isInterfaceDeclaration(s) ||
            ts.isTypeAliasDeclaration(s) ||
            ts.isEmptyStatement(s) ||
            (ts.isExpressionStatement(s) && ts.isStringLiteral(s.expression))
          )
        ) {
          throw Error(
            "파일 초기화 동작을 생략할 수 없어 계산을 중단했습니다. / Unsupported module initialization.",
          );
        }
      }
    }
    return sf;
  };
  const bad = (n: ts.Node) => {
    throw Error(
      `미리보기에서 지원하지 않는 구문: ${ts.SyntaxKind[n.kind]} / Unsupported preview syntax.`,
    );
  };
  const own = (o: unknown, key: string | number) => {
    if (["__proto__", "prototype", "constructor"].includes(String(key)))
      throw Error("접근할 수 없는 속성입니다. / Blocked property.");
    if (
      o !== null &&
      o !== undefined &&
      Object.prototype.hasOwnProperty.call(o, key)
    )
      return (o as Record<string, unknown>)[key];
    if (Array.isArray(o) && key === "length") return o.length;
    throw Error(`확인할 수 없는 속성: ${String(key)}`);
  };
  type Env = Map<string, unknown>;
  const uninitialized = Symbol("uninitialized");
  function binding(
    sf: ts.SourceFile,
    name: string,
    env: Env,
    seen = new Set<string>(),
  ): unknown {
    tick();
    if (env.has(name)) {
      const value = env.get(name);
      if (value === uninitialized)
        throw Error(`초기화 전 값 참조: ${name} / Read before initialization.`);
      return value;
    }
    if (name === "undefined") return undefined;
    const key = sf.fileName + ":" + name;
    if (seen.has(key)) throw Error("순환 값 참조입니다. / Circular binding.");
    seen.add(key);
    for (const s of sf.statements) {
      if (ts.isVariableStatement(s))
        for (const d of s.declarationList.declarations) {
          if (ts.isIdentifier(d.name) && d.name.text === name && d.initializer)
            return expr(d.initializer, sf, new Map(), seen);
        }
      if (ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier)) {
        const b = s.importClause?.namedBindings;
        if (b && ts.isNamedImports(b)) {
          const im = b.elements.find((e) => e.name.text === name);
          if (im) {
            const target = resolveImport(
              sf.fileName,
              s.moduleSpecifier.text,
              paths,
            );
            if (!target)
              throw Error(
                "외부 라이브러리나 경로 별칭은 미리보기에서 실행할 수 없습니다.",
              );
            const targetSf = get(target);
            const importedName = im.propertyName?.text || im.name.text;
            if (
              !targetSf.statements.some(
                (x) =>
                  ts.isVariableStatement(x) &&
                  x.declarationList.declarations.some(
                    (d) => d.name.getText(targetSf) === importedName,
                  ) &&
                  ts
                    .getModifiers(x)
                    ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword),
              )
            )
              throw Error("내보내지 않은 값입니다. / Value is not exported.");
            return binding(
              targetSf,
              im.propertyName?.text || im.name.text,
              new Map(),
              seen,
            );
          }
        }
      }
    }
    throw Error(`값을 확인할 수 없습니다: ${name} / Unresolved value.`);
  }
  function expr(
    n: ts.Expression,
    sf: ts.SourceFile,
    env: Env,
    seen?: Set<string>,
  ): any {
    tick();
    if (ts.isNumericLiteral(n)) return Number(n.text);
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))
      return n.text;
    if (n.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (n.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (n.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isIdentifier(n)) return binding(sf, n.text, env, seen);
    if (
      ts.isParenthesizedExpression(n) ||
      ts.isAsExpression(n) ||
      ts.isNonNullExpression(n)
    )
      return expr(n.expression, sf, env, seen);
    if (ts.isPrefixUnaryExpression(n)) {
      const v = expr(n.operand, sf, env);
      if (n.operator === ts.SyntaxKind.MinusToken) return -v;
      if (n.operator === ts.SyntaxKind.PlusToken) return +v;
      if (n.operator === ts.SyntaxKind.ExclamationToken) return !v;
      return bad(n);
    }
    if (ts.isConditionalExpression(n))
      return expr(
        expr(n.condition, sf, env) ? n.whenTrue : n.whenFalse,
        sf,
        env,
      );
    if (ts.isBinaryExpression(n)) {
      const op = n.operatorToken.getText(sf),
        l = expr(n.left, sf, env);
      if (op === "&&") return l && expr(n.right, sf, env);
      if (op === "||") return l || expr(n.right, sf, env);
      if (op === "??") return l ?? expr(n.right, sf, env);
      const r = expr(n.right, sf, env);
      switch (op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "/":
          return l / r;
        case "%":
          return l % r;
        case "**":
          return l ** r;
        case ">=":
          return l >= r;
        case ">":
          return l > r;
        case "<=":
          return l <= r;
        case "<":
          return l < r;
        case "===":
          return l === r;
        case "!==":
          return l !== r;
        case "==":
          return l == r;
        case "!=":
          return l != r;
        default:
          return bad(n);
      }
    }
    if (ts.isArrayLiteralExpression(n))
      return n.elements.map((x) => expr(x as ts.Expression, sf, env));
    if (ts.isObjectLiteralExpression(n)) {
      const obj: Record<string, unknown> = Object.create(null);
      for (const p of n.properties) {
        if (ts.isPropertyAssignment(p)) {
          if (ts.isComputedPropertyName(p.name)) bad(p);
          const k =
            ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)
              ? p.name.text
              : p.name.getText(sf);
          if (["__proto__", "constructor", "prototype"].includes(k)) bad(p);
          obj[k] = expr(p.initializer, sf, env);
        } else if (ts.isShorthandPropertyAssignment(p))
          obj[p.name.text] = binding(sf, p.name.text, env);
        else bad(p);
      }
      return obj;
    }
    if (ts.isPropertyAccessExpression(n))
      return own(expr(n.expression, sf, env), n.name.text);
    if (ts.isElementAccessExpression(n))
      return own(
        expr(n.expression, sf, env),
        expr(n.argumentExpression, sf, env),
      );
    if (ts.isCallExpression(n)) {
      const values = n.arguments.map((x) => expr(x, sf, env));
      if (ts.isIdentifier(n.expression)) {
        if (env.has(n.expression.text)) return bad(n);
        return invoke(sf, n.expression.text, values);
      }
      if (
        ts.isPropertyAccessExpression(n.expression) &&
        ts.isIdentifier(n.expression.expression) &&
        n.expression.expression.text === "Math"
      ) {
        if (
          env.has("Math") ||
          sf.statements.some(
            (s) =>
              (ts.isVariableStatement(s) &&
                s.declarationList.declarations.some(
                  (d) => d.name.getText(sf) === "Math",
                )) ||
              (ts.isImportDeclaration(s) &&
                s.importClause?.getText(sf).includes("Math")),
          )
        )
          return bad(n);
        const methods: Record<string, (...a: number[]) => number> = {
          round: Math.round,
          floor: Math.floor,
          ceil: Math.ceil,
          abs: Math.abs,
          min: Math.min,
          max: Math.max,
        };
        const fn = Object.hasOwn(methods, n.expression.name.text)
          ? methods[n.expression.name.text]
          : undefined;
        if (fn && values.every((x) => typeof x === "number"))
          return fn(...values);
      }
      return bad(n);
    }
    return bad(n);
  }
  function statements(
    nodes: readonly ts.Statement[],
    sf: ts.SourceFile,
    env: Env,
  ): { value: unknown } | undefined {
    for (const statement of nodes)
      if (
        ts.isVariableStatement(statement) &&
        statement.declarationList.flags & ts.NodeFlags.BlockScoped
      ) {
        for (const declaration of statement.declarationList.declarations)
          env.set(declaration.name.getText(sf), uninitialized);
      }
    for (const s of nodes) {
      tick();
      const line = sf.getLineAndCharacterOfPosition(s.getStart(sf)).line + 1;
      if (ts.isReturnStatement(s)) {
        const value = s.expression ? expr(s.expression, sf, env) : undefined;
        trace.push({
          line,
          text: `${sf.fileName} · 결과 / return: ${displayValue(value)}`,
        });
        return { value };
      }
      if (ts.isIfStatement(s)) {
        const value = expr(s.expression, sf, env);
        trace.push({
          line,
          text: `${s.expression.getText(sf)} → ${Boolean(value)}`,
        });
        const branch = value ? s.thenStatement : s.elseStatement;
        if (branch) {
          const r = statements(
            ts.isBlock(branch) ? branch.statements : [branch],
            sf,
            new Map(env),
          );
          if (r) return r;
        }
      } else if (ts.isVariableStatement(s)) {
        if (!(s.declarationList.flags & ts.NodeFlags.BlockScoped)) bad(s);
        for (const d of s.declarationList.declarations) {
          if (!ts.isIdentifier(d.name)) bad(d);
          env.set(
            d.name.getText(sf),
            d.initializer ? expr(d.initializer, sf, env) : undefined,
          );
        }
      } else if (ts.isBlock(s)) {
        const r = statements(s.statements, sf, new Map(env));
        if (r) return r;
      } else if (ts.isThrowStatement(s)) {
        if (
          ts.isNewExpression(s.expression) &&
          ts.isIdentifier(s.expression.expression) &&
          s.expression.expression.text === "Error"
        )
          throw Error(
            String(
              s.expression.arguments?.[0]
                ? expr(s.expression.arguments[0], sf, env)
                : "오류",
            ),
          );
        throw Error(String(expr(s.expression, sf, env)));
      } else if (
        !ts.isIfStatement(s) &&
        !ts.isEmptyStatement(s) &&
        !ts.isReturnStatement(s)
      )
        bad(s);
    }
    return undefined;
  }
  function invoke(sf: ts.SourceFile, name: string, values: unknown[]): unknown {
    tick();
    if (++depth > 32)
      throw Error("호출 깊이 한도를 넘었습니다. / Recursion limit.");
    try {
      let fn:
        | ts.FunctionDeclaration
        | ts.ArrowFunction
        | ts.FunctionExpression
        | undefined;
      for (const s of sf.statements) {
        if (ts.isFunctionDeclaration(s) && s.name?.text === name) fn = s;
        if (ts.isVariableStatement(s))
          for (const d of s.declarationList.declarations) {
            if (
              ts.isIdentifier(d.name) &&
              d.name.text === name &&
              d.initializer &&
              (ts.isArrowFunction(d.initializer) ||
                ts.isFunctionExpression(d.initializer))
            )
              fn = d.initializer;
          }
        if (
          ts.isImportDeclaration(s) &&
          ts.isStringLiteral(s.moduleSpecifier)
        ) {
          const b = s.importClause?.namedBindings;
          if (b && ts.isNamedImports(b)) {
            const im = b.elements.find((e) => e.name.text === name);
            if (im) {
              const target = resolveImport(
                sf.fileName,
                s.moduleSpecifier.text,
                paths,
              );
              if (!target)
                throw Error("외부 기능은 미리보기에서 실행할 수 없습니다.");
              const targetSf = get(target);
              const exported = targetSf.statements.some(
                (x) =>
                  ((ts.isFunctionDeclaration(x) &&
                    x.name?.text === (im.propertyName?.text || name)) ||
                    (ts.isVariableStatement(x) &&
                      x.declarationList.declarations.some(
                        (d) =>
                          d.name.getText(targetSf) ===
                          (im.propertyName?.text || name),
                      ))) &&
                  ts.canHaveModifiers(x) &&
                  ts
                    .getModifiers(x)
                    ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword),
              );
              if (!exported)
                throw Error(
                  "직접 내보낸 기능만 미리보기로 연결할 수 있습니다.",
                );
              return invoke(targetSf, im.propertyName?.text || name, values);
            }
          }
        }
      }
      if (!fn?.body)
        throw Error(`미리보기에서 기능을 찾을 수 없습니다: ${name}`);
      if (
        fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ||
        fn.asteriskToken
      )
        throw Error("비동기·제너레이터 기능은 미리보기를 지원하지 않습니다.");
      const env: Env = new Map();
      fn.parameters.forEach((p) => env.set(p.name.getText(sf), uninitialized));
      fn.parameters.forEach((p, i) => {
        if (!ts.isIdentifier(p.name) || p.dotDotDotToken) bad(p);
        env.set(
          p.name.getText(sf),
          values[i] === undefined && p.initializer
            ? expr(p.initializer, sf, env)
            : values[i],
        );
      });
      return ts.isBlock(fn.body)
        ? statements(fn.body.statements, sf, env)?.value
        : expr(fn.body, sf, env);
    } finally {
      depth--;
    }
  }
  try {
    const result = invoke(get(path), functionName, args);
    // The same bounded value must be displayable by both worker and JSON UIs.
    encodePreviewMessage(result);
    return { ok: true, result, trace };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      trace,
    };
  }
}
