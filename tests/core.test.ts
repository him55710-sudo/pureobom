import { describe, it, expect } from "vitest";
import { analyzeFile, linkFiles, resolveImport } from "../src/core/analyze";
import { applyPatch, makePatch, parseRequest } from "../src/core/edit";
import { simulate } from "../src/core/simulate";
import { eligible, readFiles } from "../src/core/import";
import { demo } from "../src/demo";
const shipping = demo[0];
describe("source-grounded analysis", () => {
  it("extracts exact editable source ranges and nested control flow", () => {
    const a = analyzeFile(shipping);
    expect(a.functions[0].params).toEqual([
      {
        name: "subtotal",
        type: "number",
        optional: false,
        label: { ko: "부분 합계", en: "Subtotal" },
      },
    ]);
    const r = a.rules.find((x) => x.name === "freeShippingThreshold")!;
    expect(shipping.content.slice(r.start, r.end)).toBe("50000");
    expect(r.line).toBe(2);
    expect(a.functions[0].steps[1].kind).toBe("condition");
    expect(a.functions[0].steps[1].children[0].kind).toBe("return");
  });
  it("keeps unknown statements explicit instead of inventing behavior", () => {
    const a = analyzeFile({
      path: "a.ts",
      content: "function f(x){switch(x){case 1:return 4;default:return 9;}}",
    });
    expect(a.functions[0].steps[0].supported).toBe(false);
    expect(a.functions[0].steps[0].text.ko).toContain("원문");
  });
  it("does not confuse comments and strings with active code", () => {
    const a = analyzeFile({
      path: "a.ts",
      content:
        '// fetch("url"); const secret="bad"\nconst message = "if (x) fetch(secret)";',
    });
    expect(a.functions).toHaveLength(0);
    expect(a.issues).toHaveLength(0);
    expect(a.rules).toHaveLength(1);
  });
  it("handles JSX without pretending to render it", () => {
    const a = analyzeFile({
      path: "a.tsx",
      content: "export const Card = () => <div>Hello</div>;",
    });
    expect(a.syntaxValid).toBe(true);
    expect(a.functions[0].steps[0].text.ko).toContain("실행 환경");
  });
  it("reports parse errors", () =>
    expect(
      analyzeFile({ path: "a.ts", content: "function f( {" }).syntaxValid,
    ).toBe(false));
  it("does not claim Python analysis", () =>
    expect(
      analyzeFile({ path: "a.py", content: "def f():\n return 1" }).kind,
    ).toBe("text"));
  it("keeps valid and invalid JSON separate", () => {
    expect(
      analyzeFile({ path: "a.json", content: '{"a":1}' }).syntaxValid,
    ).toBe(true);
    expect(
      analyzeFile({ path: "a.json", content: "{a:1}" }).issues[0].level,
    ).toBe("error");
  });
  it("links relative imports, index modules and js-to-ts specifiers", () => {
    const paths = new Set(["src/a.ts", "src/lib/index.ts", "src/b.ts"]);
    expect(resolveImport("src/a.ts", "./lib", paths)).toBe("src/lib/index.ts");
    expect(resolveImport("src/a.ts", "./b.js", paths)).toBe("src/b.ts");
    expect(resolveImport("src/a.ts", "@/b", paths)).toBeUndefined();
    expect(
      linkFiles(demo.map((file) => analyzeFile(file))).find(
        (f) => f.path === "src/order.ts",
      )?.imports[0].target,
    ).toBe("src/shipping.ts");
  });
  it("uses review candidates instead of asserting fetch is broken", () => {
    const a = analyzeFile(demo[3]);
    expect(a.issues[0].detail.ko).toContain("처리할 수도");
    expect(
      analyzeFile({
        path: "a.ts",
        content:
          'async function f(){try {await fetch("x")}catch(e){return null;}}',
      }).issues,
    ).toHaveLength(0);
  });
  it("preserves unicode and CRLF positions", () => {
    const f = {
      path: "a.ts",
      content: "// 한글 😀\r\nconst quantity = -3;\r\n",
    };
    const r = analyzeFile(f).rules[0];
    expect(f.content.slice(r.start, r.end)).toBe("-3");
    expect(r.line).toBe(2);
  });
});
describe("bounded edits", () => {
  it("changes only the selected source range and leaves all other bytes intact", () => {
    const rule = analyzeFile(shipping).rules[0];
    const p = makePatch(shipping, rule.id, "70000");
    expect(p.updated).toBe(shipping.content.replace("50000", "70000"));
    expect(p.semanticChecked).toBe(false);
    expect(applyPatch(shipping, p).content).toBe(p.updated);
  });
  it("rejects stale patches, including edits outside the target", () => {
    const p = makePatch(shipping, analyzeFile(shipping).rules[0].id, "70000");
    expect(() =>
      applyPatch({ ...shipping, content: shipping.content + "\n" }, p),
    ).toThrow("Stale");
  });
  it.each(["NaN", "Infinity", "1; alert(1)", "0x10", "1,000", "1e999", ""])(
    "rejects unsafe or ambiguous numeric input %s",
    (input) =>
      expect(() =>
        makePatch(shipping, analyzeFile(shipping).rules[0].id, input),
      ).toThrow(),
  );
  it("escapes strings rather than inserting code", () => {
    const f = { path: "a.ts", content: 'const welcomeMessage="hello";' };
    const r = analyzeFile(f).rules[0];
    const value = '";fetch("evil");\n';
    const p = makePatch(f, r.id, value);
    expect(
      analyzeFile({ path: f.path, content: p.updated }).rules[0].value,
    ).toBe(value);
    expect(
      analyzeFile({ path: f.path, content: p.updated }).issues,
    ).toHaveLength(0);
  });
  it("supports explicit comparison edits", () => {
    const r = analyzeFile(shipping).rules.find(
      (x) => x.type === "operator" && x.raw === ">=",
    )!;
    expect(makePatch(shipping, r.id, ">").updated).toContain(
      "subtotal > freeShippingThreshold",
    );
    expect(() => makePatch(shipping, r.id, "|| true")).toThrow();
  });
  it("maps Korean and English sentences to the same edit", () => {
    const rules = analyzeFile(shipping).rules;
    expect(parseRequest("무료 배송 기준을 70000으로 변경", rules).value).toBe(
      "70000",
    );
    expect(
      parseRequest("change freeShippingThreshold to 70000", rules).rule.id,
    ).toBe(rules[0].id);
  });
  it("asks for a single unambiguous target and value", () => {
    const rules = analyzeFile(shipping).rules;
    expect(() =>
      parseRequest("무료 배송 기준을 5만에서 7만으로 변경", rules),
    ).toThrow();
    expect(() =>
      parseRequest("무료 배송 기준과 기본 배송비를 10으로 변경", rules),
    ).toThrow();
    expect(() => parseRequest("결제 기능을 만들어줘", rules)).toThrow();
    expect(() =>
      parseRequest("무료 배송 기준을 50,000으로 변경", rules),
    ).toThrow();
  });
  it("rejects invalid source before editing", () => {
    const f = { path: "a.ts", content: "const quantity = 2; function(" };
    expect(() => makePatch(f, analyzeFile(f).rules[0].id, "3")).toThrow();
  });
});
describe("restricted calculation preview", () => {
  it.each([
    [0, 3000],
    [49999, 3000],
    [50000, 0],
    [60000, 0],
  ])("calculates shipping %i → %i", (input, want) =>
    expect(
      simulate(demo, shipping.path, "calculateShipping", [input]),
    ).toMatchObject({ ok: true, result: want }),
  );
  it("compares a real before/after change at the boundary", () => {
    const p = makePatch(shipping, analyzeFile(shipping).rules[0].id, "70000");
    const changed = demo.map((f) =>
      f.path === p.path ? { ...f, content: p.updated } : f,
    );
    expect(simulate(demo, p.path, "calculateShipping", [60000]).result).toBe(0);
    expect(simulate(changed, p.path, "calculateShipping", [60000]).result).toBe(
      3000,
    );
    expect(simulate(changed, p.path, "calculateShipping", [70000]).result).toBe(
      0,
    );
  });
  it("resolves explicitly imported pure functions", () =>
    expect(
      simulate(demo, "src/order.ts", "createOrder", [40000, true]),
    ).toMatchObject({
      ok: true,
      result: { subtotal: 40000, discount: 4000, shipping: 3000, total: 39000 },
    }));
  it("reports thrown input errors and keeps trace", () => {
    const r = simulate(demo, shipping.path, "calculateShipping", [-1]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("0 이상");
    expect(r.trace.length).toBeGreaterThan(0);
  });
  it("refuses network and unknown runtime functions", () => {
    expect(simulate(demo, "src/products.ts", "loadProducts", []).ok).toBe(
      false,
    );
    const f = {
      path: "a.ts",
      content: 'function f(){return fetch("https://example.com")}',
    };
    expect(simulate([f], f.path, "f", []).ok).toBe(false);
  });
  it.each([
    "globalThis",
    "window",
    "process",
    "({}).constructor",
    "({}).__proto__",
    'eval("1+1")',
    'Function("return 1")()',
  ])("never exposes host capabilities: %s", (expression) => {
    const f = { path: "a.ts", content: `function f(){return ${expression}}` };
    expect(simulate([f], f.path, "f", []).ok).toBe(false);
  });
  it("bounds recursion and non-terminating loops", () => {
    const f = { path: "a.ts", content: "function f(){return f()}" };
    expect(simulate([f], f.path, "f", []).ok).toBe(false);
    const loop = {
      path: "a.ts",
      content: "function f(){while(true){} return 1;}",
    };
    expect(simulate([loop], loop.path, "f", []).ok).toBe(false);
  });
  it("short-circuits branches without calling unavailable code", () => {
    const f = {
      path: "a.ts",
      content: 'function f(){return false && fetch("x")}',
    };
    expect(simulate([f], f.path, "f", [])).toMatchObject({
      ok: true,
      result: false,
    });
  });
  it("handles default parameters and object outputs", () => {
    const f = {
      path: "a.ts",
      content:
        "const taxRate=0.1; function f(price=100){return {tax:price*taxRate, total:price*(1+taxRate)}}",
    };
    expect(simulate([f], f.path, "f", []).result).toMatchObject({ tax: 10 });
  });
});
describe("local import boundaries", () => {
  it.each([
    ".env",
    "secrets/.env.local",
    "node_modules/a.ts",
    ".git/config",
    "dist/bundle.js",
    "foo.exe",
    "package-lock.json",
  ])("skips %s", (p) => expect(eligible(p)).toBe(false));
  it.each(["src/app.tsx", "a.py", "README.md", "package.json"])(
    "preserves %s",
    (p) => expect(eligible(p)).toBe(true),
  );
  it("imports text, skips binary and preserves relative paths", async () => {
    const a = new File(["const quantity=2;"], "a.ts");
    Object.defineProperty(a, "webkitRelativePath", {
      value: "project/src/a.ts",
    });
    const b = new File(["\0bad"], "b.ts");
    Object.defineProperty(b, "webkitRelativePath", { value: "project/b.ts" });
    const r = await readFiles([a, b]);
    expect(r.files).toEqual([
      { path: "src/a.ts", content: "const quantity=2;" },
    ]);
    expect(r.skipped).toHaveLength(1);
  });
});
