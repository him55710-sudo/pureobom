import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { createHash } from "node:crypto";

export type PackageScript = {
  file: string;
  name: string;
  command: string;
  before?: string;
  after?: string;
};

/** Exact common checks only; dev/watch/install/publish are not inferred as checks. */
export function isPackageCheck(definition: { type: string; script?: unknown }) {
  return (
    definition.type === "npm" &&
    typeof definition.script === "string" &&
    ["test", "build", "check", "typecheck", "lint"].includes(definition.script)
  );
}

const inside = (root: string, path: string) => {
  const rest = relative(root, path);
  return (
    rest !== ".." &&
    !rest.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) &&
    !isAbsolute(rest)
  );
};

/** Read only the manifest identified by a discovered VS Code npm task. */
export async function readPackageScript(
  root: string,
  definition: { type: string; path?: unknown; script?: unknown },
) {
  if (definition.type !== "npm") return undefined;
  if (
    typeof definition.script !== "string" ||
    !definition.script ||
    (definition.path !== undefined && typeof definition.path !== "string")
  )
    throw Error("Invalid package task definition");
  const path = resolve(root, (definition.path as string) || "", "package.json");
  if (!inside(root, path)) throw Error("Package task is outside the workspace");
  const [rootReal, fileReal] = await Promise.all([
    realpath(root),
    realpath(path),
  ]);
  if (!inside(rootReal, fileReal))
    throw Error("Package task is outside the workspace");
  if ((await stat(fileReal)).size > 128 * 1024)
    throw Error("Package manifest exceeds 128 KiB");
  const bytes = await readFile(fileReal);
  if (bytes.byteLength > 128 * 1024)
    throw Error("Package manifest exceeds 128 KiB");
  const manifest = JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
  const scripts = manifest?.scripts;
  if (!scripts || typeof scripts !== "object" || Array.isArray(scripts))
    throw Error("Package scripts are unavailable");
  const name = definition.script;
  const script = (key: string) =>
    Object.hasOwn(scripts, key) && typeof scripts[key] === "string"
      ? (scripts[key] as string)
      : undefined;
  const command = script(name);
  if (!command?.trim()) throw Error("Package script is unavailable");
  return {
    fingerprint: createHash("sha256").update(bytes).digest("hex"),
    view: {
      file: relative(root, path).split("\\").join("/"),
      name,
      command,
      before: script(`pre${name}`),
      after: script(`post${name}`),
    } satisfies PackageScript,
  };
}
