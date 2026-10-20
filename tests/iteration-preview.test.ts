import { describe, it, expect } from "vitest";
import { simulate } from "../src/core/simulate";
import {
  displayValue,
  encodePreviewMessage,
  decodePreviewMessage,
} from "../src/core/previewValues";

const run = (source: string, args: unknown[] = []) =>
  simulate(
    [{ path: "iteration.js", content: source }],
    "iteration.js",
    "f",
    args,
  );
// Only these fixed, repository-authored fixtures are executed by Node. Product
// previews interpret syntax; they never import or evaluate uploaded source.
async function native(source: string, args: unknown[]) {
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(source + "\nexport { f };").toString("base64")}`
  );
  return module.f(...args);
}
const cases: [string, string, unknown[]][] = [
  [
    "module values and functions preserve identity",
    "const xs=[1];const convert=x=>x;function f(){return [xs===xs,convert===convert,f===f];}",
    [],
  ],
  [
    "loop updates the outer binding",
    "function f(n){let i=0,total=0;while(i<n){total+=i;i++;}return total;}",
    [7],
  ],
  [
    "continue and break keep loop control",
    "function f(){let i=0,sum=0;while(i<12){i++;if(i%2===0)continue;if(i>8)break;sum+=i;}return [i,sum];}",
    [],
  ],
  [
    "nested break affects only its loop",
    "function f(){let i=0,total=0;while(i<3){let j=0;while(j<4){j++;if(j===2)break;total++;}i++;}return total;}",
    [],
  ],
  [
    "early return leaves a loop",
    "function f(n){while(n>0){if(n===2)return n;n--;}return 0;}",
    [5],
  ],
  [
    "block shadowing preserves outer state",
    "function f(){let x=2;{let x=9;x++;}if(true){x+=3;}return x;}",
    [],
  ],
  [
    "closures see live local bindings",
    "function f(){let factor=2;const convert=x=>x*factor;factor=4;return [1,2,3].map(convert);}",
    [],
  ],
  [
    "map provides value index and array",
    "function f(){const xs=[4,5];return xs.map((x,i,a)=>x+i+a.length);}",
    [],
  ],
  ["map preserves holes", "function f(){return [1,,3].map(x=>x*2);}", []],
  [
    "map distinguishes undefined from holes",
    "function f(xs){return xs.map((x,i)=>x===undefined?i:x);}",
    [[undefined, 3]],
  ],
  [
    "callback block updates captured state",
    "function f(){let total=0;const values=[2,4,6].map(x=>{total+=x;return total;});return [total,values];}",
    [],
  ],
  [
    "top-level functions can be callbacks",
    "function twice(x){return x*2;}function f(){return [2,3].map(twice);}",
    [],
  ],
  [
    "named function expressions recurse locally",
    "function f(){const count=function inner(n){if(n<1)return 0;return 1+inner(n-1);};return count(4);}",
    [],
  ],
  [
    "local function declarations are hoisted",
    "function f(){const result=add(2);function add(x){return x+3;}return result;}",
    [],
  ],
  [
    "callee resolved before argument side effects",
    "function f(){let g=x=>x+1;const h=x=>x+10;return g((g=h)?2:3);}",
    [],
  ],
  [
    "receiver resolved before index side effects",
    "function f(){let xs=[10,20];return xs.at((xs=[30,40])?1:0);}",
    [],
  ],
  [
    "negative and out-of-range indexes",
    "function f(){const xs=[5,7,9];return [xs.at(-1),xs.at(-3),xs.at(-4),xs.at(3),xs.at()];}",
    [],
  ],
  [
    "index truncation and special numbers",
    "function f(){const xs=[3,8,9];return [xs.at(1.9),xs.at(-1.9),xs.at(0/0),xs.at(1/0)];}",
    [],
  ],
  [
    "string at reads UTF-16 code units",
    "function f(){return ['ABC'.at(-2),'한글'.at(0),'😀'.at(1)];}",
    [],
  ],
  [
    "shift count and signed conversion",
    "function f(x){return [x>>1,x>>>1,x<<33,x&7,x|8,x^3,~x];}",
    [-9],
  ],
  [
    "prefix and postfix numeric conversion",
    "function f(){let x='2';const a=x++;const b=++x;const c=x--;return [a,b,c,x];}",
    [],
  ],
  [
    "logical assignments short-circuit",
    "function f(){const a=false;let x=0,y=null;x||=3;y??=4;a&&=9;return [a,x,y];}",
    [],
  ],
  [
    "default parameter closure uses parameter scope",
    "const x=8;function f(get=()=>x){const x=2;return get();}",
    [],
  ],
];
describe("bounded iteration compared with independent Node execution", () => {
  it.each(cases)("%s", async (_label, source, args) => {
    const expected = await native(source, args);
    const result = run(source, args);
    expect(result.ok, result.error).toBe(true);
    const wire = decodePreviewMessage(
      JSON.parse(JSON.stringify(encodePreviewMessage(result))),
    ) as typeof result;
    expect(displayValue(wire.result)).toBe(displayValue(expected));
  });
  it.each([
    "function f(){const x=1;x=2;return x;}",
    "function f(){let x=1;{x=2;let x;}return x;}",
    "function f(a=()=>x){let x=1;return a();}",
    "function f(xs){xs[0]=9;return xs;}",
    "const x=1;function f(){x=2;return x;}",
    "function f(){return [1].map(x=>fetch('unused'));}",
    "function f(){return [1].map(x=>x.constructor);}",
    "function f(){return [1].map(x=>process);}",
    "function f(){return [1].map(x=>this.value);}",
    "function f(){return [1].map(x=>()=>x);}",
    "function f(){return [1].at('0');}",
  ])(
    "does not invent a value for unsupported mutation, scope or host access: %s",
    (source) => {
      const args = [[1, 2]];
      const before = structuredClone(args);
      expect(run(source, args).ok).toBe(false);
      expect(args).toEqual(before);
    },
  );
  it("shares a finite budget across loops and callbacks", () => {
    for (const source of [
      "function f(){while(true){}return 1;}",
      "function f(){return [1].map(x=>{while(true){}return x;});}",
    ])
      expect(run(source).error).toMatch(/budget/i);
    expect(
      run("function f(){let i=0;while(i<400){if(i>=0)i++;}return i;}").error,
    ).toMatch(/budget/i);
    const result = run(
      "function f(){let i=0;while(i<220){if(i>=0)i++;}return i;}",
    );
    expect(result.ok, result.error).toBe(true);
    expect(result.trace.length).toBeLessThanOrEqual(201);
    expect(result.trace.at(-1)?.text).toMatch(/omitted/);
  });
});
