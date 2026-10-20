import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, relative } from "node:path";
import {
  isPackageCheck,
  readPackageScript,
} from "../extension/src/packageScripts";

const owned: string[] = [];
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "pureobom-script-test-"));
  owned.push(root);
  return root;
}
afterEach(async () => {
  for (const path of owned.splice(0)) {
    const child = relative(resolve(tmpdir()), resolve(path));
    if (!child.startsWith("pureobom-script-test-") || child.includes(".."))
      throw Error("Unexpected test cleanup target");
    await rm(path, { recursive: true, force: true });
  }
});

describe("existing package check scripts", () => {
  it("recognizes exact common npm task names without guessing watch or lifecycle commands", () => {
    for (const script of ["test", "build", "check", "typecheck", "lint"])
      expect(isPackageCheck({ type: "npm", script })).toBe(true);
    for (const script of [
      "dev",
      "watch",
      "test:watch",
      "publish",
      "install",
      "posttest",
      "prebuild",
      "check;echo",
      "CHECK",
      undefined,
    ])
      expect(isPackageCheck({ type: "npm", script })).toBe(false);
    expect(isPackageCheck({ type: "shell", script: "test" })).toBe(false);
  });
  it("reads nested manifests and declared hooks without executing them, and fingerprints all manifest bytes", async () => {
    const root = await fixture(),
      nested = join(root, "packages", "with spaces");
    await mkdir(nested, { recursive: true });
    const file = join(nested, "package.json"),
      scripts = {
        check: "node --test",
        precheck: "echo before",
        postcheck: "echo after",
      };
    await writeFile(file, "\uFEFF" + JSON.stringify({ scripts }));
    const definition = {
      type: "npm",
      script: "check",
      path: "packages/with spaces",
    };
    const first = await readPackageScript(root, definition);
    expect(first?.view).toEqual({
      file: "packages/with spaces/package.json",
      name: "check",
      command: scripts.check,
      before: scripts.precheck,
      after: scripts.postcheck,
    });
    await writeFile(
      file,
      JSON.stringify({ scripts: { ...scripts, precheck: "echo changed" } }),
    );
    const second = await readPackageScript(root, definition);
    expect(second?.fingerprint).not.toBe(first?.fingerprint);
    await writeFile(
      file,
      JSON.stringify({
        scripts: { ...scripts, precheck: "echo changed" },
        packageManager: "npm@10",
      }),
    );
    expect((await readPackageScript(root, definition))?.fingerprint).not.toBe(
      second?.fingerprint,
    );
  });
  it("rejects missing, invalid or oversized manifests and nonstring scripts", async () => {
    const root = await fixture(),
      file = join(root, "package.json"),
      definition = { type: "npm", script: "check" };
    await expect(readPackageScript(root, definition)).rejects.toThrow();
    for (const source of [
      "{",
      JSON.stringify({ scripts: [] }),
      JSON.stringify({ scripts: { check: 23 } }),
      JSON.stringify({ scripts: { check: " " } }),
      " ".repeat(128 * 1024 + 1),
    ]) {
      await writeFile(file, source);
      await expect(readPackageScript(root, definition)).rejects.toThrow();
    }
    await writeFile(
      file,
      JSON.stringify({ scripts: { check: "node --test" } }),
    );
    await expect(
      readPackageScript(root, { type: "npm", script: "constructor" }),
    ).rejects.toThrow();
    await expect(
      readPackageScript(root, { type: "npm", script: "check", path: 42 }),
    ).rejects.toThrow();
    expect(await readPackageScript(root, { type: "process" })).toBeUndefined();
  });
  it("rejects traversal and a junction or symlink to a package outside the workspace", async () => {
    const parent = await fixture(),
      root = join(parent, "workspace"),
      outside = join(parent, "outside");
    await mkdir(root);
    await mkdir(outside);
    await writeFile(
      join(outside, "package.json"),
      JSON.stringify({ scripts: { check: "node --test" } }),
    );
    await expect(
      readPackageScript(root, {
        type: "npm",
        script: "check",
        path: "../outside",
      }),
    ).rejects.toThrow(/outside/);
    await symlink(
      outside,
      join(root, "linked"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await expect(
      readPackageScript(root, { type: "npm", script: "check", path: "linked" }),
    ).rejects.toThrow(/outside/);
  });
});
