# Changelog

## v1.3.0 — 2026-05-21 — Audit follow-up batch + first npm publish

**Distribution change** — sgc is now distributable via `npm install -g @sdsrss/sgc`. The unscoped `sgc` name was already taken on npm (different package). The Claude Code plugin layer still installs via `/plugin install sgc` (the marketplace name); the slash commands now auto-detect npm-installed CLI on PATH and fall back to `bun src/sgc.ts` in cwd for source-clone users.

### Distribution (P5 Tier 2: npm publish + GitHub Actions workflow)
- `package.json`: renamed `sgc` → `@sdsrss/sgc` (scoped); bumped 1.2.1 → 1.3.0; added `files`, `engines: {bun: ">=1.3"}`, `publishConfig: {access: public, provenance: true}`, `repository`, `bugs`, `homepage`, `keywords`. Dropped the `browse` bin entry (per-platform binary, not shipped via npm — build from source).
- `src/sgc.ts`: `#!/usr/bin/env bun` shebang (already present, verified executable on `npm install -g`).
- `.github/workflows/publish.yml` (new): triggers on `v*` tag push. Verifies tag matches `package.json` version, runs dispatcher tests as gate, publishes with `--access public --provenance`. Requires `NPM_TOKEN` secret in repo settings.
- 11 `plugins/sgc/commands/*.md`: consolidated Pre-flight + Invocation into one bash block that resolves `$SGC` to `sgc` (PATH) → `bun src/sgc.ts` (cwd) → prints multi-path install help and exits.
- `plugins/sgc/skills/bootstrap/SKILL.md`: dual-path install (npm primary, source-clone alternative).
- `README.md` Install/Update sections: split into "1. Install the CLI" (npm + source) and "2. Install the Claude Code plugin"; `## Update` covers both npm and source paths.
- `plugins/sgc/.claude-plugin/plugin.json`: version bumped 1.2.1 → 1.3.0; description aligned with `package.json` (no "merges best of three" framing).

### Docs (P4-lite: storage expectation-setting, defer team-sync)
- `README.md`: new `### Storage model — operator-local by design` subsection under `## State layout`. Sets explicit expectation that `.sgc/` is per-project, per-machine; calls out the no-team-sync gap; documents the manual side-repo workaround; references the design space (local/team split vs `sgc solutions sync` vs SQLite). Full team-sync feature deferred until real cross-user usage emerges.

### UX (P5 Tier 1: first-failure install guidance) — superseded by Tier 2 above
- Earlier in this version, plugin commands gained a multi-line `printf` preflight + bootstrap SKILL.md hoisted the install block. Tier 2 replaces that single-mode help with dual-path (npm + source) resolver.

### Hardening (P2: output-side Invariant §1 leak check)
- `src/dispatcher/fingerprint.ts` (new): walks `<stateRoot>/solutions/<cat>/<slug>.md`, hashes every fingerprintable line (≥25 chars, not pure markdown structure) with SHA256→16-hex. After-output scan in `spawn.ts` (post-`validateOutputShape`, pre-return) recursively walks reviewer.* / qa.* output string fields, throws `SpawnError` on collision. Other agents (planner.*, compound.*, researcher.history) exempt — they legitimately quote solutions. Per-process cache keyed by stateRoot; `clearFingerprintCache()` exposed for tests.
- Closes the LLM-mode advisory gap acknowledged in `README.md:165-174` for the lazy-copy/literal-quote class of leak; paraphrase-class leaks remain out of scope (would need n-gram overlap or embedding similarity).
- 11 unit tests + 2 spawn integration tests in `tests/dispatcher/fingerprint.test.ts`.

### Refactor (P6: declarative ROUTES table for resolveMode)
- `src/dispatcher/spawn.ts`: replaced the 10-level if-else chain in `resolveMode` with a `ROUTES: ModeRoute[]` table — each row is `{reason, resolve(opts, manifest)}`; first non-null resolution wins.
- Added `resolveModeDebug()` returning `{mode, reason}` for trace/audit output (useful for future `sgc doctor` extension and CI debugging).
- No behavior change — all 28 existing spawn tests pass unmodified. Priority order preserved verbatim from the prior chain.

### Feature (P9: sgc doctor command)
- `src/commands/doctor.ts` (new): consistency check across three name registries — (A) every manifest `prompt_path` declared → file exists in `prompts/`; (B) every `prompts/*.md` → at least one manifest references it (orphans → warn); (C) every `status: slot-only` entry → `prompt_path: null`.
- `src/sgc.ts`: registered `doctor` citty subcommand. Exit code 0 if `fail == 0`, 1 otherwise (CI-gateable).
- `plugins/sgc/commands/doctor.md`: plugin slash command `/sgc:doctor`.
- 5 unit tests in `tests/dispatcher/sgc-doctor.test.ts` cover green/missing/orphan/slot-only-with-prompt/slot-only-clean cases.
- Smoke run against current repo: **24 OK · 0 warn · 0 fail**.

### Docs (P1: positioning alignment)
- `package.json` description: dropped "Merges the best of Superpowers, gstack, and Compound Engineering" framing — sgc is a coexisting 规范层 + 知识引擎, not a vendored merger. Mirrors `docs/POSITIONING.md`.
- `README.md` header: rewrote title + first paragraph to lead with "Spec Layer + Knowledge Engine" + coexists-with-sp/gs; refreshed Status line (v1.1→v1.2.1, 8 cmds→10, 12 invariants→13, added OpenRouter + intentionally-heuristic `compound.related` callout).

### Hardening (P3: sentinel-based Invariant §1 back-channel detection)
- `src/dispatcher/spawn.ts` exports `PRIOR_ART_SENTINEL_BEGIN` / `PRIOR_ART_SENTINEL_END` HTML-comment markers (`<!-- sgc:prior-art:begin -->` / `<!-- sgc:prior-art:end -->`).
- `checkInvariantOneBackChannel`: regex updated to match sentinel **or** legacy `## Prior art (researcher.history)` heading — defense-in-depth during transition; legacy match stays permanently so out-of-band content can't slip past by dropping the sentinel.
- `src/commands/plan.ts`: researcher.history block in intent.body now wrapped in sentinel comments (heading kept inside for human readers).
- `src/commands/review.ts:stripPriorArtSection`: prefers sentinel-pair, falls back to heading-to-next-`## ` heuristic.
- New test T9 in `tests/dispatcher/spawn.test.ts`: sentinel detection works without heading; legacy heading still detected.

### Refactor (P7: compound.related naming)
- `src/dispatcher/agents/compound.ts`: `compoundRelated` → `compoundRelatedHeuristic` with `compoundRelated` alias export so callers/tests don't churn. Header comment cites `feedback_compound_related_invariant3.md` + obs #92 — the heuristic is **intentional**, not deferred LLM-swap.

## v1.2.1 — 2026-05-20 — Plugin marketplace polish

### Plugin packaging
- `.claude-plugin/marketplace.json`: renamed marketplace `sdsrss-sgc` → `sgc`; added `metadata.description` + `metadata.homepage` for `/plugin marketplace list` discoverability.
- `plugins/sgc/.claude-plugin/plugin.json`: added `homepage` + `repository` (string URLs per Claude Code plugin schema); version bumped 1.2.0 → 1.2.1 so existing installs surface this update via `/plugin update sgc`.
- 9 command files (`work / review / qa / ship / compound / status / agent-loop / discover / tail`): uniform `## Pre-flight` block matching `plan.md` — fails fast with `sgc CLI not in cwd` instead of confusing shell errors when the dispatcher source isn't present.
- `plugins/sgc/skills/bootstrap/SKILL.md`: new `## CLI Dependency` section announces the prompt-layer-only design + the CLI clone step at SessionStart so users learn the install model before their first failed command.

### Docs
- README: added `## Update` (two-step `marketplace update` + `update`) and `## Uninstall` (with note that project `.sgc/` is preserved).
- README Install section split into "Claude Code plugin" + "CLI from source" earlier in v1.2.0 follow-up commits.

### Migration
- Users on v1.2.0: `/plugin marketplace update sgc && /plugin update sgc` to pull. No CLI behavior changes; `package.json` synced 1.2.0 → 1.2.1 for traceability only.

## v1.2.0 — 2026-04-21 — Audit remediation

### Strategy
- **Positioning**: sgc declared as "规范层 + 知识引擎" alongside sp/gs. See `docs/POSITIONING.md`.

### Features
- `classifier.level`: real-LLM dispatch path via `prompts/classifier-level.md` (heuristic fallback retained)
- `reviewer.correctness`: real-LLM dispatch path via `prompts/reviewer-correctness.md` (heuristic fallback retained)
- Plugin skills (`plugins/sgc/skills/*/SKILL.md`) now dispatch to the CLI via `bun src/sgc.ts <cmd>`
- `sgc plan` / `sgc ship` auto-write `handoff.md` for session resume
- New `--force-new-task` flag for `sgc plan` when conflicting handoff exists
- Manifest field `prompt_path` for agent-to-prompt template mapping
- Manifest field `status` + `roadmap` for slot-vs-implemented agent visibility

### Performance
- Anthropic SDK: system block now cached with `cache_control: ephemeral`. System prefix is manifest-derived (byte-stable across calls); per-call data (spawn_id, scope tokens, input) moved to user block.

### Tests (357 → 445, +88)
- Eval: `classifier-llm` — heuristic limits + LLM routing readiness
- Eval: `reviewer-correctness-llm` — heuristic blind spots + LLM routing readiness
- Eval: `L3-auto-refused` — Invariant §4
- Eval: `override-reason-short` — Invariant §5
- Eval: `compound-rollback` — Invariant §10
- Eval: `reviewer-conflict` — worst-of verdict aggregation
- Eval: `resume-guard` — session handoff
- Unit: `splitPrompt`, cache-stability integration, prompt-path routing

### Docs
- New: `docs/POSITIONING.md`
- Updated: `plugins/sgc/CLAUDE.md`, `README.md`, all 8 `SKILL.md` files
- Annotated: 5 unimplemented reviewer slots + janitor.archive in capabilities.yaml

## v1.1.0 — 2026-04-16 — D-phase + E-phase

Initial release with full L0-L3 pipeline, 12 invariants, 357 tests.
See `docs/e-phase-demo.md` for details.
