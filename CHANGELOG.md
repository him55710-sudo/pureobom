# Changelog

0.7 development: preserve the full current file as selected-function/before/after source parts for focused explanation. Add a per-request CPU option with automatic Ollama selection as the default, reject invalid options and request no input truncation/context shifting. [Actual-project follow-up](docs/evidence/local-ai/focused-context-cpu.md): three completed CPU responses still fail citation or semantic review; this is not a model-quality or speedup claim. Stable/Pages remain 0.6.0.

Go addition in the 0.7 development source: [model-free syntax reading and exact literal edits](docs/GO_SOURCE.md) through an installed Go SDK and fixed standard-library helper. Preserve multiple returns, defer/concurrency distinctions and source positions; validate proposed Go syntax without building user code. A deliberate Google UUID initializer regression fails upstream tests and undo restores them. Types, scope, dependencies and optimization remain unchecked.

## 0.7.0 — local AI development preview (unreleased)

- Add [structured explanations](docs/STRUCTURED_EXPLANATIONS.md): separate actual input checks from caller requirements, require a response for every attached calculation example and link it to an existing exact source citation. Display host-calculated values beside model prose. Reject missing/duplicate examples and replacement value fields; coverage remains separate from semantic accuracy. Editing and optimization response formats are unchanged.

- Show request-scoped local AI stages and label timeout/network failures with their stage. Keep the default three-minute generation limit and offer explicit five/ten-minute choices with host validation, matching UI deadlines and cancellation. A completed real-project 3B response still contradicted supplied observations; a 4B request timed out. Do not infer explanation correctness from exact citations or attached observations.

- Add [optional calculation observations](docs/EXPLANATION_OBSERVATIONS.md) for selected JS/TS explanations. Calculate user examples without AI, preserve special values, and attach only current host-retained results. Reject mismatched function ranges and stale observations. Actual private-code observations match six native returns; one case is unavailable. Model-quality improvement remains unassessed after separate inference and preflight timeouts.

- Fix [calculation trace source navigation](docs/TRACE_NAVIGATION.md) across imported files. Show the originating path and line, resolve only recorded locations in the host, reject stale text and superseded calculation handles, and leave omission notices unlinked. Keep local partial checks, full-suite failures and CI evidence separate.

- Add [bounded while loops, local updates and interpreted array callbacks](docs/BOUNDED_PREVIEW.md) to JS/TS previews. Preserve lexical scope, evaluation order and sparse map positions; keep existing execution budgets and explicit unsupported results. The unchanged real-project target now matches Node for three original assertion cases and eleven separately selected inputs. This does not resolve prior model explanation failures or establish an optimization.

- Preserve special calculation values and negative-zero inputs across VS Code JSON messages, result/trace displays and Markdown; distinguish real strings from numeric NaN/infinities. Add Korean/English explanations and scan projects beneath hidden ancestor folders without including hidden project content. [Evidence](docs/evidence/local-ai/preview-values.md) separates four matched actual-code inputs from the still-unavailable requested function and prior model failures.

- Select an analyzed function from the reading view or local explanation panel. Resolve its range in the host, keep full-file context, require an exact source citation overlapping the function, and reject stale selections. Show Korean/English focus labels and distinguish input checks from caller preconditions in the prompt. [Actual-project attempts](docs/evidence/local-ai/focused-explanation.md) timed out; model explanation quality remains unverified. Use neutral default names for generic totals and amounts instead of implying payment-specific meaning.

- Add [bundled Rust source reading and exact literal edits](docs/RUST_SOURCE.md) in desktop VS Code, without an API, model or Rust SDK. Preserve source positions, numeric suffixes and raw strings; show match arms and parser limits. Validate Rust AI proposals syntactically. Windows/Ubuntu development and installed flows pass. The original humantime tests pass 42 → fail 8 after a deliberate constant edit → pass 42 after native undo in a separate Windows run. Parser-level types, ownership, general compilation and optimization remain unchecked.

- Read supported Python statement structure in Korean/English through an isolated local AST helper; no model or user-code execution. Preserve loop else, ordered exception branches and finally. Edit assigned literals with exact numeric spelling, Unicode source positions, native diff/apply/undo and stale checks. Publish limits, interpreter setup and an actual itsdangerous regression/restore in [Python source](docs/PYTHON_SOURCE.md).

- Read JSON/JSONC literal facts in Korean and English without a model. Search key paths and values, jump to source, and preview/apply/undo one string, number or boolean. Preserve numeric spelling and surrounding source; block duplicate-key ranges and stale edits. Document display limits and unverified consumer behavior in [JSON data](docs/JSON_DATA.md).
- Keep browser notices in the selected language when switching Korean/English after applying or undoing a change.

- Measure a reviewed process task before and after edits: one warm-up plus seven fresh runs, elapsed time, OS peak process memory, output hashes and optional project-check evidence. Report observed variation and failures; reject stale conditions and incompatible comparisons. Local Python standard library only, with cancellation and per-run limits. See [measurement scope](docs/BENCHMARKS.md).

- Add optional Ollama explanations and multiple exact-range edits in desktop VS Code. Require cloud-disabled loopback service and installed local text models; no paid API or API key fallback.
- Ground citations and edits in unique original source ranges, require changed-source evidence, bound requests, and cancel stale work. Review the native diff and unchecked behavior before explicit apply; use normal editor undo.
- Check proposed JS/TS/JSX/TSX and JSON syntax; parse Python with an isolated local interpreter without executing user code. Added language-specific parser paths and their limits are tracked in [language support](docs/LANGUAGE_SUPPORT.md).
- Publish the implementation plan, agent work log, actual Python/model/editor evidence and a failed optimization: itsdangerous tests passed before and after, but the proposed function was slower and was not adopted.
- Add explicitly reviewed project test/build commands through VS Code tasks, with saved-file checks, real exit codes, cancellation and stale-result notices. Validate itsdangerous tests passing, a known regression failing and undo restoring 297 passing tests. See [project checks](docs/PROJECT_CHECKS.md).
- Preserve TSX/JSX source extensions in native rule diffs instead of labeling every preview as TypeScript.
- This is not verified support for every language or automatic optimization. See [local AI setup and limitations](docs/LOCAL_AI.md).
- Add JSONC structure and proposal syntax checks with comments/trailing commas, preserving strict JSON rules. Validate the packaged worker outside project dependencies and isolate each VS Code test profile.
- Publish 28 actual local-model responses across 14 language identifiers with semantic errors and rejected edits included. Choose model context size from bounded request size; do not claim universal quality or measured speedups.

## 0.6.0 — understand the editor's reports

- Connect current-file VS Code diagnostics to a compact summary and the Review view, with provider, severity, original message and exact source navigation.
- Explain four common TypeScript errors in Korean and English while preserving original messages and leaving unknown reports untranslated.
- Distinguish edited reports, reject stale report/file navigation, show empty reports without a pass claim and cap long lists/messages with visible omissions.
- Add a typed shipping example and real TypeScript integration coverage: apply an invalid literal value, inspect error 2322, navigate and undo.
- These are existing editor reports, not a new full-project type checker or pre-apply semantic verification. No scripts, provider commands or automatic fixes are run.

## 0.5.2 — explain cleanup in the correct order

- Keep `finally` separate from the try body and display it after catch in both the story and Markdown export.
- Explain pending returns through enclosing finalizers, keep nested function boundaries intact, and stop describing catch behavior when there is no catch.
- Bound else and finalizer rendering at the same depth as ordinary child steps.
- Add a realistic async save example, semantic/renderer regressions and a VS Code worker/source-link integration check. The restricted simulator does not gain async or try/catch execution support.

## 0.5.1 — from the demo to your own code

- Add shared installation and feedback help to the browser and VS Code panel, plus a next-step card after a browser demo edit.
- Prepare and copy a user-reviewed experience summary locally. Do not attach source/paths, place feedback in URLs, send telemetry or create issues automatically. Link to a bilingual GitHub experience form.
- Keep successful, stuck and unsupported experiences distinct. Add an empty observation sheet and first-use study protocol; no user results are claimed.
- Scope sidebar navigation styles and keep mobile install/export actions reachable.

## 0.5.0 — read the interface, change its words

- Read JSX/TSX elements, component props, text, conditional branches and simple map callbacks as an expandable, source-linked structure in VS Code and the browser.
- Edit static JSX text and quoted attributes with compiler-correct whitespace/entity decoding and inert string-expression replacements. Re-editing and native undo work through the existing checked patch path.
- Distinguish render-time calls from passed event functions. Display spread/complex expressions and truncation limits explicitly. React components are excluded from the calculation simulator.
- Add a React membership-card example, VS Code command, direct browser demo link and multiline text inputs.
- Add 14 core checks and a real TSX editor integration flow. Browser demo history now accurately explains that changes are not saved.

## 0.4.0 — your project's words

- Add Korean/English names for source declarations in the browser and VS Code, without renaming source identifiers.
- Bind terms to lexical symbols so shadowed names keep their own meaning; use custom names in stories, function inputs, rule tables and sentence edits.
- Persist terms per browser workspace or VS Code document URI; isolate demo mode and untitled documents.
- Invalidate pending changes when terminology changes and retain cache entries for unaffected files.
- Cover name binding, sentence edits, reset, input limits and file-switch behavior. Restrict unit-test discovery to the maintained source tests.

## 0.3.0 — open-source preview

- Compare up to 12 input scenarios against the actual pending change in the browser and VS Code.
- Editable input tables and suggested numeric boundary cases; unsupported results remain unavailable.
- Export a bilingual Markdown comparison report without automatic uploads.
- Isolated browser demo mode, a direct first-change walkthrough, and relative assets for static hosting.
- MIT repository license, contributor and security guidance, issue templates and CI definitions.
- Versioned VSIX, source and offline-demo packaging with SHA-256 checksums.

This is a preview, not a production assurance tool. User demand, comprehension gains and retention have not yet been measured.

## 0.2.0 — VS Code prototype

Native editor explanations, source navigation, diff, buffer edits and undo; document version checks and workspace import graph.

## 0.1.0 — browser prototype

Korean/English stories, rules, dependency map, local file import, constrained patches and a restricted AST interpreter.
