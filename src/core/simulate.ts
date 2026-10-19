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
  let traceCharacters = 0,
    traceOmitted = false;
  const record = (path: string, line: number, text: string) => {
    if (trace.length >= 200 || traceCharacters >= 30000) {
      if (!traceOmitted)
        trace.push({
          line,
          text: "이후 과정 표시는 생략했습니다. / Further trace entries omitted.",
        });
      traceOmitted = true;
      return;
    }
    const shown =
      text.length > 2000
        ? text.slice(0, 2000) + "… [표시 한도 / display limit]"
        : text;
    traceCharacters += shown.length;
    trace.push({ path, line, text: shown });
  };
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
  const uninitialized = Symbol("uninitialized");
  const moduleValues = new Map<string, unknown>();
  type Slot = { value: unknown; mutable: boolean };
  class Env {
    readonly values = new Map<string, Slot>();
    constructor(readonly parent?: Env) {}
    slot(name: string): Slot | undefined {
      return this.values.get(name) || this.parent?.slot(name);
    }
    has(name: string) {
      return !!this.slot(name);
    }
    get(name: string) {
      return this.slot(name)?.value;
    }
    declare(name: string, mutable: boolean, value: unknown = uninitialized) {
      if (this.values.has(name))
        throw Error("중복 선언 / Duplicate declaration.");
      this.values.set(name, { value, mutable });
    }
    initialize(name: string, value: unknown) {
      this.values.get(name)!.value = value;
    }
    assign(name: string, value: unknown) {
      const slot = this.slot(name);
      if (!slot || slot.value === uninitialized || !slot.mutable)
        throw Error(
          "지역 변수에 대입할 수 없습니다. / Cannot assign this local binding.",
        );
      slot.value = value;
      return value;
    }
  }
  type FunctionNode =
    | ts.FunctionDeclaration
    | ts.ArrowFunction
    | ts.FunctionExpression;
  const closures = new WeakMap<
    object,
    { fn: FunctionNode; sf: ts.SourceFile; env: Env }
  >();
  function closure(fn: FunctionNode, sf: ts.SourceFile, env: Env) {
    // Opaque data, never a host function. The symbol also prevents returning it
    // as an apparently ordinary JSON result through the preview transport.
    const value = Object.freeze(
      Object.assign(Object.create(null), {
        [Symbol("preview function")]: true,
      }),
    );
    closures.set(value, { fn, sf, env });
    return value;
  }
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
    if (moduleValues.has(key)) return moduleValues.get(key);
    if (seen.has(key)) throw Error("순환 값 참조입니다. / Circular binding.");
    seen.add(key);
    for (const s of sf.statements) {
      if (ts.isVariableStatement(s))
        for (const d of s.declarationList.declarations) {
          if (
            ts.isIdentifier(d.name) &&
            d.name.text === name &&
            d.initializer
          ) {
            const value = expr(d.initializer, sf, new Env(), seen);
            moduleValues.set(key, value);
            return value;
          }
        }
      if (ts.isFunctionDeclaration(s) && s.name?.text === name) {
        const value = closure(s, sf, new Env());
        moduleValues.set(key, value);
        return value;
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
                  ((ts.isVariableStatement(x) &&
                    x.declarationList.declarations.some(
                      (d) => d.name.getText(targetSf) === importedName,
                    )) ||
                    (ts.isFunctionDeclaration(x) &&
                      x.name?.text === importedName)) &&
                  ts
                    .getModifiers(x)
                    ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword),
              )
            )
              throw Error("내보내지 않은 값입니다. / Value is not exported.");
            return binding(
              targetSf,
              im.propertyName?.text || im.name.text,
              new Env(),
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
    if (ts.isArrowFunction(n) || ts.isFunctionExpression(n))
      return closure(n, sf, env);
    if (
      ts.isParenthesizedExpression(n) ||
      ts.isAsExpression(n) ||
      ts.isNonNullExpression(n)
    )
      return expr(n.expression, sf, env, seen);
    if (ts.isPrefixUnaryExpression(n)) {
      if (
        n.operator === ts.SyntaxKind.PlusPlusToken ||
        n.operator === ts.SyntaxKind.MinusMinusToken
      ) {
        if (!ts.isIdentifier(n.operand)) return bad(n);
        const value =
          Number(binding(sf, n.operand.text, env)) +
          (n.operator === ts.SyntaxKind.PlusPlusToken ? 1 : -1);
        return env.assign(n.operand.text, value);
      }
      const v = expr(n.operand, sf, env);
      if (n.operator === ts.SyntaxKind.MinusToken) return -v;
      if (n.operator === ts.SyntaxKind.PlusToken) return +v;
      if (n.operator === ts.SyntaxKind.ExclamationToken) return !v;
      if (n.operator === ts.SyntaxKind.TildeToken) return ~v;
      return bad(n);
    }
    if (ts.isPostfixUnaryExpression(n)) {
      if (!ts.isIdentifier(n.operand)) return bad(n);
      const previous = Number(binding(sf, n.operand.text, env));
      env.assign(
        n.operand.text,
        previous + (n.operator === ts.SyntaxKind.PlusPlusToken ? 1 : -1),
      );
      return previous;
    }
    if (ts.isConditionalExpression(n))
      return expr(
        expr(n.condition, sf, env) ? n.whenTrue : n.whenFalse,
        sf,
        env,
      );
    if (ts.isBinaryExpression(n)) {
      const op = n.operatorToken.getText(sf);
      const assignment =
        n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        n.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
      if (assignment && !ts.isIdentifier(n.left)) return bad(n);
      if (op === "=")
        return env.assign(
          (n.left as ts.Identifier).text,
          expr(n.right, sf, env),
        );
      const l = expr(n.left, sf, env);
      if (assignment) {
        if (
          (op === "&&=" && !l) ||
          (op === "||=" && l) ||
          (op === "??=" && l !== null && l !== undefined)
        )
          return l;
        const r = expr(n.right, sf, env);
        const value = ["&&=", "||=", "??="].includes(op)
          ? r
          : binary(op.slice(0, -1), l, r, n);
        return env.assign((n.left as ts.Identifier).text, value);
      }
      if (op === "&&") return l && expr(n.right, sf, env);
      if (op === "||") return l || expr(n.right, sf, env);
      if (op === "??") return l ?? expr(n.right, sf, env);
      const r = expr(n.right, sf, env);
      return binary(op, l, r, n);
    }
    if (ts.isArrayLiteralExpression(n)) {
      const values = new Array(n.elements.length);
      n.elements.forEach((x, i) => {
        if (!ts.isOmittedExpression(x))
          values[i] = expr(x as ts.Expression, sf, env);
      });
      return values;
    }
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
      if (n.questionDotToken) return bad(n);
      // Resolve the callee/receiver before evaluating arguments, as JavaScript does.
      if (ts.isIdentifier(n.expression)) {
        const fn = binding(sf, n.expression.text, env);
        return invoke(
          fn,
          n.arguments.map((x) => expr(x, sf, env)),
        );
      }
      if (
        ts.isArrowFunction(n.expression) ||
        ts.isFunctionExpression(n.expression) ||
        ts.isParenthesizedExpression(n.expression)
      ) {
        const fn = expr(n.expression, sf, env);
        return invoke(
          fn,
          n.arguments.map((x) => expr(x, sf, env)),
        );
      }
      if (
        ts.isPropertyAccessExpression(n.expression) &&
        !n.expression.questionDotToken
      ) {
        const receiver = n.expression.expression,
          method = n.expression.name.text;
        if (ts.isIdentifier(receiver) && receiver.text === "Math") {
          if (
            env.has("Math") ||
            sf.statements.some(
              (s) =>
                (ts.isVariableStatement(s) &&
                  s.declarationList.declarations.some(
                    (d) => d.name.getText(sf) === "Math",
                  )) ||
                (ts.isFunctionDeclaration(s) && s.name?.text === "Math") ||
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
          const fn = Object.hasOwn(methods, method)
            ? methods[method]
            : undefined;
          if (!fn) return bad(n);
          const values = n.arguments.map((x) => expr(x, sf, env));
          if (values.every((x) => typeof x === "number")) return fn(...values);
          return bad(n);
        }
        const target = expr(receiver, sf, env);
        if (
          (Array.isArray(target) || typeof target === "string") &&
          !Object.prototype.hasOwnProperty.call(target, method)
        ) {
          if (method === "at") {
            const values = n.arguments.map((x) => expr(x, sf, env));
            if (values[0] !== undefined && typeof values[0] !== "number")
              return bad(n);
            return target.at(values[0] ?? 0);
          }
          if (method === "map" && Array.isArray(target)) {
            const values = n.arguments.map((x) => expr(x, sf, env));
            if (
              !values[0] ||
              typeof values[0] !== "object" ||
              !closures.has(values[0])
            )
              return bad(n);
            const result = new Array(target.length);
            for (let i = 0; i < target.length; i++) {
              tick();
              if (Object.hasOwn(target, i))
                result[i] = invoke(values[0], [target[i], i, target]);
            }
            return result;
          }
        }
      }
      return bad(n);
    }
    return bad(n);
  }
  function binary(op: string, l: any, r: any, n: ts.Node): any {
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
      case "&":
        return l & r;
      case "|":
        return l | r;
      case "^":
        return l ^ r;
      case "<<":
        return l << r;
      case ">>":
        return l >> r;
      case ">>>":
        return l >>> r;
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
  type Flow =
    | { kind: "return"; value: unknown }
    | { kind: "break" | "continue" };
  function statements(
    nodes: readonly ts.Statement[],
    sf: ts.SourceFile,
    env: Env,
  ): Flow | undefined {
    for (const statement of nodes)
      if (
        ts.isVariableStatement(statement) &&
        statement.declarationList.flags & ts.NodeFlags.BlockScoped
      ) {
        for (const declaration of statement.declarationList.declarations)
          env.declare(
            declaration.name.getText(sf),
            !(statement.declarationList.flags & ts.NodeFlags.Const),
          );
      } else if (ts.isFunctionDeclaration(statement) && statement.name)
        env.declare(statement.name.text, true, closure(statement, sf, env));
    for (const s of nodes) {
      tick();
      const line = sf.getLineAndCharacterOfPosition(s.getStart(sf)).line + 1;
      if (ts.isReturnStatement(s)) {
        const value = s.expression ? expr(s.expression, sf, env) : undefined;
        record(sf.fileName, line, `결과 / return: ${displayValue(value)}`);
        return { kind: "return", value };
      }
      if (ts.isIfStatement(s)) {
        const value = expr(s.expression, sf, env);
        record(
          sf.fileName,
          line,
          `${s.expression.getText(sf)} → ${Boolean(value)}`,
        );
        const branch = value ? s.thenStatement : s.elseStatement;
        if (branch) {
          const r = statements(
            ts.isBlock(branch) ? branch.statements : [branch],
            sf,
            new Env(env),
          );
          if (r) return r;
        }
      } else if (ts.isVariableStatement(s)) {
        if (!(s.declarationList.flags & ts.NodeFlags.BlockScoped)) bad(s);
        for (const d of s.declarationList.declarations) {
          if (!ts.isIdentifier(d.name)) bad(d);
          env.initialize(
            d.name.getText(sf),
            d.initializer ? expr(d.initializer, sf, env) : undefined,
          );
        }
      } else if (ts.isBlock(s)) {
        const r = statements(s.statements, sf, new Env(env));
        if (r) return r;
      } else if (ts.isWhileStatement(s)) {
        let iterations = 0;
        try {
          while (expr(s.expression, sf, env)) {
            tick();
            iterations++;
            const flow = statements([s.statement], sf, new Env(env));
            if (flow?.kind === "return") return flow;
            if (flow?.kind === "break") break;
          }
        } finally {
          record(
            sf.fileName,
            line,
            `반복 진입 / loop entries: ${iterations} · ${s.expression.getText(sf)}`,
          );
        }
      } else if (ts.isBreakStatement(s) || ts.isContinueStatement(s)) {
        if (s.label) bad(s);
        return { kind: ts.isBreakStatement(s) ? "break" : "continue" };
      } else if (ts.isExpressionStatement(s)) {
        expr(s.expression, sf, env);
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
        !ts.isFunctionDeclaration(s) &&
        !ts.isEmptyStatement(s) &&
        !ts.isReturnStatement(s)
      )
        bad(s);
    }
    return undefined;
  }
  function invoke(value: unknown, values: unknown[]): unknown {
    tick();
    const captured =
      value !== null && typeof value === "object"
        ? closures.get(value)
        : undefined;
    if (!captured)
      throw Error("호출할 수 없는 값입니다. / Not an interpreted function.");
    const { fn, sf } = captured;
    if (++depth > 32)
      throw Error("호출 깊이 한도를 넘었습니다. / Recursion limit.");
    try {
      if (
        !fn.body ||
        fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ||
        fn.asteriskToken
      )
        throw Error("비동기·제너레이터 기능은 미리보기를 지원하지 않습니다.");
      let parent = captured.env;
      if (ts.isFunctionExpression(fn) && fn.name) {
        parent = new Env(parent);
        parent.declare(fn.name.text, false, value);
      }
      const env = new Env(parent);
      fn.parameters.forEach((p) => env.declare(p.name.getText(sf), true));
      fn.parameters.forEach((p, i) => {
        if (!ts.isIdentifier(p.name) || p.dotDotDotToken) bad(p);
        env.initialize(
          p.name.getText(sf),
          values[i] === undefined && p.initializer
            ? expr(p.initializer, sf, env)
            : values[i],
        );
      });
      if (!ts.isBlock(fn.body)) return expr(fn.body, sf, env);
      const names = new Set(fn.parameters.map((p) => p.name.getText(sf)));
      for (const s of fn.body.statements)
        if (
          ts.isVariableStatement(s) &&
          s.declarationList.declarations.some((d) =>
            names.has(d.name.getText(sf)),
          )
        )
          bad(s);
      const flow = statements(fn.body.statements, sf, new Env(env));
      if (flow && flow.kind !== "return")
        throw Error("반복문 밖 제어 / Loop control outside a loop.");
      return flow?.kind === "return" ? flow.value : undefined;
    } finally {
      depth--;
    }
  }
  try {
    const sf = get(path);
    const result = invoke(binding(sf, functionName, new Env()), args);
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
