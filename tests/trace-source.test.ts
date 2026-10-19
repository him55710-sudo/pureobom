import { describe, expect, it } from "vitest";
import { simulate } from "../src/core/simulate";
import {
  decodePreviewMessage,
  encodePreviewMessage,
} from "../src/core/previewValues";
import type { Simulation } from "../src/core/types";

describe("calculation source locations", () => {
  const files = [
    {
      path: "main.ts",
      content:
        "import { helper } from './nested/helper';\nexport function f() {\n  return helper(2);\n}\n",
    },
    {
      path: "nested/helper.ts",
      content:
        "export function helper(n: number) {\n  if (n < 0) return 0;\n  while (n > 1) { n--; }\n  return [n].map(x => {\n    return x * 3;\n  })[0];\n}\n",
    },
  ];
  it("keeps separate paths and exact lines for imported conditions, loops, callbacks and returns", () => {
    const actual = decodePreviewMessage(
      JSON.parse(
        JSON.stringify(
          encodePreviewMessage(simulate(files, "main.ts", "f", [])),
        ),
      ),
    ) as Simulation;
    expect(actual.ok).toBe(true);
    expect(actual.result).toBe(3);
    expect(actual.trace.map(({ path, line }) => ({ path, line }))).toEqual([
      { path: "nested/helper.ts", line: 2 },
      { path: "nested/helper.ts", line: 3 },
      { path: "nested/helper.ts", line: 5 },
      { path: "nested/helper.ts", line: 4 },
      { path: "main.ts", line: 3 },
    ]);
  });
  it("retains source locations on partial failed calculations", () => {
    const actual = simulate(
      [
        {
          path: "failed.ts",
          content:
            "export function f() {\n if (true) { throw new Error('stop'); }\n}",
        },
      ],
      "failed.ts",
      "f",
      [],
    );
    expect(actual.ok).toBe(false);
    expect(actual.trace[0]).toMatchObject({ path: "failed.ts", line: 2 });
  });
  it("does not present the trace omission notice as a source location", () => {
    const actual = simulate(
      [
        {
          path: "long.ts",
          content:
            "export function f(){let n=0;while(n<220){if(n>=0)n++;}return n;}",
        },
      ],
      "long.ts",
      "f",
      [],
    );
    expect(actual.ok).toBe(true);
    expect(actual.trace).toHaveLength(201);
    expect(
      actual.trace.slice(0, 200).every((step) => step.path === "long.ts"),
    ).toBe(true);
    expect(actual.trace[200].text).toMatch(/omitted/);
    expect(actual.trace[200].path).toBeUndefined();
  });
});
