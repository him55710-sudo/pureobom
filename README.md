<div align="center">

# Pureobom · 풀어봄

### Read it. Change it. Check it.

Understand the code AI wrote. Change a rule. See which cases change.

**Product-first development:** [Detailed plan](docs/PRODUCT_COMPLETION.md) · [Language support and evidence](docs/LANGUAGE_SUPPORT.md) · [Agent work log](docs/AGENT_WORKLOG.md). The 0.7 development source adds optional [local Ollama explanations and edits](docs/LOCAL_AI.md). Actual Python project evidence includes a rejected, slower optimization. The published 0.6.0 and browser demo do not include local AI.

**VS Code extension · Korean / English · Local processing · MIT**

Development evidence: [Read nested function bodies without AI](docs/NESTED_FUNCTIONS.md) · [Actual explanation splitting experiment: failed, not adopted](docs/SPLIT_EXPLANATION_EXPERIMENT.md).

[HTML/CSS source facts and value edits](docs/HTML_CSS_SOURCE.md) now use bundled parsers in the browser and VS Code. They read tags, text, selectors and declarations without executing scripts or guessing rendered layout. Ordinary text, selected attributes and CSS values support preview, apply and undo; actual page behavior still needs checking.

The [external modern-normalize check](docs/evidence/local-ai/web-source-project.md) runs all 54 upstream Chrome tests through VS Code: a deliberate CSS edit adds two failures, and undo restores the baseline. Seven pre-existing failures and eight assertion-free TODOs are disclosed; this is not an all-tests-passed claim.

The development source reads [JSON/JSONC values without a model](docs/JSON_DATA.md): exact key paths, types and source lines, plus preview/apply/undo for individual values. It preserves numeric spelling and comments, marks duplicate keys, and does not infer what a consuming program does.

In desktop VS Code, it also reads [Python statement structure and exact literals](docs/PYTHON_SOURCE.md) using an installed isolated Python interpreter. No model/API is needed. Branches, exceptions and source-linked value edits are partial static support; upstream tests caught a deliberate wrong edit and passed again after undo.

An installed Go SDK also enables [Go source reading and exact literal edits](docs/GO_SOURCE.md), including multiple returns, defer and source-linked branches. A fixed local parser reads user code as data. The Google UUID regression test demonstrates a wrong edit failing upstream tests and undo restoring them; this is not full Go type checking.

Installed JDK 21+ enables [Java source reading and exact literal edits](docs/JAVA_SOURCE.md), including partial branch, exception and resource-cleanup structure. It parses user text without compiling or executing it. Type, dependency and runtime checks remain separate.

[SQLite source reading and literal edits](docs/SQL_SOURCE.md) work after selecting SQLite explicitly for the current SQL file. The bundled parser needs no model, API or database connection. It reads partial query structure and preserves exact numbers/quoted strings; schema, results and performance still need project checks. Other SQL dialects are not yet analyzed.

The development source also connects [project test/build commands](docs/PROJECT_CHECKS.md). Review the command, save changes, and see its actual exit code and whether files changed after the check started.

It also adds [before/after command measurements](docs/BENCHMARKS.md): seven elapsed-time and peak-memory samples, output hashes, observed variation and local JSON reports. Requires Python 3 and a reviewed repeatable process task; this is measurement evidence, not an automatic optimization guarantee.

[한국어](README.ko.md) · [Watch 30 seconds](https://him55710-sudo.github.io/pureobom/demo.html) · [Try the demo](https://him55710-sudo.github.io/pureobom/?demo=shipping&lang=en) · [Install](#try-it) · [Examples](examples/README.md) · [Contribute](CONTRIBUTING.md)

[![Verify](https://github.com/him55710-sudo/pureobom/actions/workflows/ci.yml/badge.svg)](https://github.com/him55710-sudo/pureobom/actions/workflows/ci.yml)

</div>

[![Watch a real rule change in Pureobom](public/media/demo-poster.png)](https://him55710-sudo.github.io/pureobom/demo.html)

**[Watch the 30-second walkthrough](https://him55710-sudo.github.io/pureobom/demo.html)** — source → explanation → diff → comparison → apply → undo. Real browser screenshots, edited for reading time; English and Korean captions. [MP4](https://him55710-sudo.github.io/pureobom/media/pureobom-30s.mp4).

Pureobom turns JavaScript and TypeScript into source-linked stories, editable rules and a dependency map. It is for people who know what their product should do but struggle to inspect the code an AI generates.

Change a free-shipping threshold from **50,000 to 70,000**. Compare several order amounts. Inspect the exact code diff, apply the change in VS Code, and undo it with the editor's normal undo command.

| Order subtotal | Before | After | What changed? |
| --- | --- | --- | --- |
| 49,999 | 3,000 | 3,000 | Same |
| 50,000 | 0 | 3,000 | Shipping now charged |
| 60,000 | 0 | 3,000 | Shipping now charged |
| 70,000 | 0 | 0 | Still free |

These are computed example outputs, not an application-wide correctness claim.

## Try it

**New in 0.6 — understand editor errors:** in VS Code, review reported errors and warnings beside the explanation, read plain-language help for common TypeScript errors and jump to the exact code. Try changing a typed shipping fee to an unsupported value, then undo. [Walkthrough and limits](docs/EDITOR_REPORTS.md). Empty reports are not a passed type check; the browser demo does not provide VS Code diagnostics.

**VS Code — the primary experience**

1. Download `pureobom-0.6.0.vsix` from [Releases](https://github.com/him55710-sudo/pureobom/releases) (or build it below).
2. In VS Code, open Extensions → `…` → **Install from VSIX…**.
3. Run **Pureobom: Try an example** in the Command Palette. In a Korean VS Code installation, the command is **풀어봄: 예제로 시작하기**.
4. Edit the threshold, compare inputs, inspect the native diff, then apply. `Ctrl+Z` / `Cmd+Z` undoes; `Ctrl+S` / `Cmd+S` saves.

**Browser — no account or API key**

[Open the live demo](https://him55710-sudo.github.io/pureobom/?demo=shipping&lang=en). One click prepares a rule change; compare the outcomes before applying it. Your own files stay on your device.

With Node.js 24 and pnpm 11.25.0 installed, from this source folder:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:5173/?demo=shipping&lang=en` (use `lang=ko` for Korean). Demo mode does not read or overwrite your saved browser workspace. Remove `demo=shipping` to use the persistent local workspace.

The prebuilt `pureobom-0.6.0-demo.zip` only needs Node.js 24: unzip, run `node scripts/serve.mjs`, and open the printed address. On Windows, double-click `START.cmd`.

Source: [him55710-sudo/pureobom](https://github.com/him55710-sudo/pureobom). Marketplace publication is not yet available; use the VSIX distribution.

**After your first change:** open **Install & feedback** in the demo or **Help & feedback** in VS Code. Try one task with your own code, then optionally review and copy a feedback summary. Nothing is submitted automatically. [Feedback guide](docs/FEEDBACK.md) · [Planned user study](docs/USER_STUDY.md).

## What works today

- **Read:** Korean/English explanations anchored to the exact source lines, including unsaved VS Code edits.
- **Follow cleanup:** read try, catch and finally as separate paths, including pending returns through cleanup. [Corrected in 0.5.2](docs/CONTROL_FLOW.md).
- **Read a React interface:** expand JSX elements, text, conditions and event props. Select a phrase and change the real source with a checked diff. [Try it](https://him55710-sudo.github.io/pureobom/?demo=interface&lang=en) · [Scope and limits](docs/INTERFACE.md).
- **Use your words:** give unfamiliar variables, functions and inputs your own Korean/English names. Terms stay tied to their declarations and work in sentence edits. [How project terms work](docs/TERMINOLOGY.md).
- **Explore:** function inputs, conditions, returns, a rule table, static relative-import graph and limited review hints.
- **Change:** numbers, strings, booleans and comparison operators through the same checked patch path.
- **Compare:** up to 12 editable input cases, suggested numeric boundaries, before/after outputs and an explicit unavailable state.
- **Explain to someone else:** a local Markdown report containing the displayed comparison. Nothing is automatically published.
- **Stay in control:** native diff, explicit apply, normal save/undo, stale-document checks and local workers.

## Know the boundary

This is an **early preview**, not an AI coding agent or a replacement for a developer's review.

| Area | Current boundary |
| --- | --- |
| Languages | JS/TS/JSX/TSX and related extensions; JSON overview. Other imported text is preserved, not explained. |
| Editing | Literals and comparison operators. No whole-feature generation or multi-file refactoring. |
| Understanding | Syntax-grounded descriptions, a built-in name glossary and your local project terms; no inferred business intent. |
| Comparison | Restricted AST interpretation of supported synchronous calculations. The 0.7 development branch adds [bounded while loops, local updates and array callbacks](docs/BOUNDED_PREVIEW.md). No arbitrary code execution, network, DOM or external packages. Published 0.6 does not include the iteration addition. |
| Verification | Syntax checks, limited static hints and VS Code-reported current-file diagnostics. No pre-apply type check, whole-project verification, application tests or security audit. |
| File limits | Up to 300 imported text files, 512 KB/file and 8 MB total. Exports contain imported files only. |
| Privacy | Analysis stays on-device. Normal hosted-demo asset requests still reach its host; browser workspaces persist in IndexedDB outside demo mode. |

An unavailable case is not a pass. A correct output for a few inputs does not prove a program correct. The import graph is a static relationship map, not complete runtime impact analysis. See [security and privacy](SECURITY.md).

## Build and verify

The full test suite requires local Python and Go in addition to Node/pnpm; CI pins Python 3.12 and Go 1.27.2. See [contributor setup](CONTRIBUTING.md). No local AI model is required for these tests.

```sh
pnpm test
pnpm build
pnpm extension:build
pnpm extension:test      # downloads an isolated VS Code test host on first run
pnpm extension:package
pnpm release:package    # VSIX must already exist; creates source/demo ZIPs + SHA-256 sums
pnpm release:check      # verifies checksums and required contents
```

On Linux, run the integration step with `xvfb-run -a pnpm extension:test`. CI definitions cover Windows and Linux; local results are recorded separately in [validation](docs/RELEASE_VALIDATION.md).

The browser and extension share the analysis engine. The parser stays in a worker; UI code imports only lightweight view models. [Architecture](docs/ARCHITECTURE.md) · [Research](docs/RESEARCH.md) · [Product direction](docs/PRODUCT.md) · [Launch plan](docs/LAUNCH.md)

## Help make code understandable

Bring a small example where the explanation is confusing, improve a translation, or contribute a useful scenario. Start with [CONTRIBUTING.md](CONTRIBUTING.md). A reproducible counterexample is valuable even if you do not write code.

Licensed under [MIT](LICENSE). Bundled third-party licenses remain their own. No claims of measured user demand, retention or comprehension gains are made yet.
