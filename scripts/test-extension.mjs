import { runTests, runVSCodeCommand } from "@vscode/test-electron";
import { mkdir, mkdtemp, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { resolve } from "node:path";
const installed = process.argv.includes("--installed");
const workspaces = resolve("test-results/extension-workspaces");
await mkdir(workspaces, { recursive: true });
const workspace = await mkdtemp(resolve(workspaces, ".run-"));
await writeFile(
  resolve(workspace, "tsconfig.json"),
  JSON.stringify({
    compilerOptions: {
      noEmit: true,
      strict: true,
      types: [],
      jsx: "react-jsx",
    },
    include: ["*.ts", "*.tsx"],
    typeAcquisition: { enable: false },
  }),
);
await writeFile(
  resolve(workspace, "shipping.ts"),
  `import { helper } from './helper';\nconst freeShippingThreshold = 50000;\nconst shippingFee = 3000;\nexport function calculateShipping(subtotal: number) {\n  if (subtotal < 0) throw new Error('negative');\n  if (subtotal >= freeShippingThreshold) return 0;\n  return shippingFee;\n}\n`,
);
await writeFile(resolve(workspace, "helper.ts"), "export const helper = 1;\n");
await mkdir(resolve(workspace, ".private"));
await writeFile(
  resolve(workspace, ".private/hidden.ts"),
  "export const hidden = 1;\n",
);
await writeFile(resolve(workspace, ".hidden.ts"), "export const hidden = 2;\n");
await mkdir(resolve(workspace, ".vscode"), { recursive: true });
await writeFile(
  resolve(workspace, ".vscode/tasks.json"),
  JSON.stringify(
    {
      version: "2.0.0",
      tasks: [
        [
          "Pureobom check success",
          "require('node:assert/strict').equal(2 + 2, 4); console.log('assertion passed')",
        ],
        ["Pureobom check failure", "process.exit(7)"],
        ["Pureobom check delayed", "setTimeout(() => process.exit(0), 2000)"],
        ["Pureobom check cancel", "setInterval(() => {}, 1000)"],
        ["Pureobom check shell", "process.exit(0)"],
        ["Pureobom check background", "process.exit(0)"],
        [
          "Pureobom benchmark",
          "const s=require('node:fs').readFileSync(process.argv[1],'utf8'); const b=Buffer.alloc(8*1024*1024,1); setTimeout(()=>console.log(s.includes('bench-output')?'different':'stable'),s.includes('bench-slow')?160:60)",
        ],
      ].map(([label, code]) => ({
        label,
        type: label.endsWith("shell") ? "shell" : "process",
        isBackground: label.endsWith("background"),
        command: process.execPath,
        args: [
          "-e",
          label.endsWith("shell") ? { value: code, quoting: "strong" } : code,
          ...(label === "Pureobom benchmark" ? ["${file}"] : []),
        ],
        group: "test",
        problemMatcher: [],
      })),
    },
    null,
    2,
  ),
);
const profiles = resolve("test-results/vscode-test-profiles");
await mkdir(profiles, { recursive: true });
const profile = await mkdtemp(resolve(profiles, "run-"));
await mkdir(resolve(profile, "User"));
await writeFile(
  resolve(profile, "User/settings.json"),
  JSON.stringify({
    "typescript.tsserver.log": "verbose",
    // Virtual/untitled fixtures must not scan this repository's package.json
    // for auto-import suggestions before processing the real diagnostic check.
    "typescript.preferences.includePackageJsonAutoImports": "off",
    "javascript.preferences.includePackageJsonAutoImports": "off",
    "typescript.disableAutomaticTypeAcquisition": true,
    "extensions.autoUpdate": false,
    "extensions.autoCheckUpdates": false,
  }),
);
let developmentPath = resolve("extension");
let extensionsPath = resolve("test-results/vscode-extensions");
let expectedInstallation;
if (installed) {
  const { version } = JSON.parse(
    await readFile("extension/package.json", "utf8"),
  );
  const vsixPath = resolve(`release/pureobom-${version}.vsix`);
  const bytes = await readFile(vsixPath);
  const zip = await JSZip.loadAsync(bytes);
  const files = {};
  for (const path of [
    "out/extension.cjs",
    "out/worker.cjs",
    "runtime/benchmark.py",
    "runtime/python_source.py",
    "runtime/go_source.go",
    "runtime/PureobomJavaSource.java",
    "runtime/PureobomCSharpSource.cs",
    "runtime/rust/tree-sitter-rust.wasm",
    "runtime/rust/web-tree-sitter.wasm",
    "media/view.js",
    "media/view.css",
  ])
    files[path] = createHash("sha256")
      .update(await zip.file(`extension/${path}`).async("nodebuffer"))
      .digest("hex");
  extensionsPath = resolve(profile, "installed-extensions");
  developmentPath = resolve(profile, "test-driver");
  await mkdir(developmentPath);
  await writeFile(
    resolve(developmentPath, "package.json"),
    JSON.stringify({
      name: "pureobom-test-driver",
      publisher: "pureobom-tests",
      version: "0.0.0",
      engines: { vscode: "^1.96.0" },
      main: "driver.cjs",
      activationEvents: ["onStartupFinished"],
    }),
  );
  await writeFile(
    resolve(developmentPath, "driver.cjs"),
    "exports.activate=()=>{};\n",
  );
  const installation = await runVSCodeCommand(
    [
      "--install-extension",
      vsixPath,
      "--force",
      "--user-data-dir",
      profile,
      "--extensions-dir",
      extensionsPath,
    ],
    { version: "1.96.4" },
  );
  console.log(installation.stdout.trim());
  expectedInstallation = {
    version,
    vsixSha256: createHash("sha256").update(bytes).digest("hex"),
    extensionsPath,
    files,
  };
}
await runTests({
  version: "1.96.4",
  extensionDevelopmentPath: developmentPath,
  extensionTestsPath: resolve("extension/out/integration.cjs"),
  extensionTestsEnv: {
    PUREOBOM_EXPECTED_INSTALL: expectedInstallation
      ? JSON.stringify(expectedInstallation)
      : "",
    PUREOBOM_ONLY_BENCHMARK: process.env.PUREOBOM_ONLY_BENCHMARK || "0",
    PUREOBOM_INTEGRATION_REPORT: resolve(
      installed
        ? "test-results/installed-extension-integration.json"
        : process.env.PUREOBOM_ONLY_BENCHMARK === "1"
          ? "test-results/benchmark-integration.json"
          : "test-results/extension-integration.json",
    ),
  },
  launchArgs: [
    workspace,
    ...(installed ? [] : ["--disable-extensions"]),
    "--disable-workspace-trust",
    "--skip-welcome",
    "--skip-release-notes",
    "--disable-updates",
    "--user-data-dir",
    profile,
    "--extensions-dir",
    extensionsPath,
  ],
});
