# SGC — Unified Engineering Agent

A single Claude Code workflow combining process discipline (Superpowers), real-world QA + ship pipeline (gstack), and knowledge compounding (Compound Engineering). One CLI, one state layer, one set of invariants.

**Status**: v1.1 — full L0→L3 pipeline with stub agents end-to-end. All 8 sgc commands, 9 agent stubs, all 12 invariants enforced at runtime. Real LLM integration via `ANTHROPIC_API_KEY` (Anthropic SDK) or local `claude` binary (subscription) — auto-detected. See [docs/c-phase-dispatcher.md](docs/c-phase-dispatcher.md) + [docs/d-phase-plan.md](docs/d-phase-plan.md) for the build history; roadmap (E-phase) in [#/] TBD.

---

## Install

```bash
git clone <this-repo> sgc && cd sgc

# bun client doesn't honor HTTP_PROXY; use npm for install
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install

# bun is the runtime (build, test, run TypeScript directly)
bun --version    # ≥1.3
```

Lockfile: `package-lock.json` (npm). Bun reads it fine.

## Quick start

```bash
# 1. Plan a task (classifier → planner.eng → write intent)
#    L1+ requires --motivation ≥20 words (sgc-state.schema.yaml min_words);
#    L0 tasks (typo/format/comment) skip intent.md entirely.
bun src/sgc.ts plan "add an Example section to plan/SKILL.md" \
  --motivation "Newcomers can't verify the skill end-to-end without sample input/output, so add a runnable Example block matching the format used elsewhere in the repo."

# 2. Track progress (no LLM here — you implement, dispatcher tracks)
bun src/sgc.ts work                    # list features, highlight active
bun src/sgc.ts work --add "verify"     # append a feature
bun src/sgc.ts work --done f1          # mark done, advance

# 3. Review the diff (reviewer.correctness against git diff HEAD)
bun src/sgc.ts review                  # or --base <ref>

# 4. Dashboard
bun src/sgc.ts status
```

State files land under `.sgc/` in the project (override via `SGC_STATE_ROOT`). The `.sgc/` directory is `.gitignore`d — runtime state, not source.

## Commands

| Command | Status | Purpose |
|---------|--------|---------|
| `sgc plan <task> [--motivation\|--signed-by\|--level]` | ✅ | Classify L0-L3; L1+ runs planner cluster (L2 adds ceo+researcher; L3 adds adversarial); writes immutable `decisions/{id}/intent.md` |
| `sgc work [--add\|--done]` | ✅ | Track `feature-list.md` progress |
| `sgc review [--base <ref>]` | ✅ | reviewer.correctness on git diff → append-only review report |
| `sgc qa [<target>] [--flows a,b,c]` | ✅ | qa.browser agent writes review report; L2+ ship requires this |
| `sgc ship [--auto\|--pr\|--no-janitor\|--force-compound]` | ✅ | 8-gate ship; writeShip; optional `gh pr create`; auto-janitor invokes compound |
| `sgc compound [--force\|--slug]` | ✅ | 4-agent compound cluster + dedup (0.85 threshold) + write `solutions/{cat}/{slug}.md` |
| `sgc status` | ✅ | Active task + level + last activity |
| `sgc agent-loop [--list\|--show\|--submit]` | ✅ | File-poll fulfillment helper (for external Claude session) |
| `sgc discover <topic>` | ⏸ stub | Requirements clarification (deferred) |

Two more CLIs from the same repo:

| Command | Purpose |
|---------|---------|
| `sgc-convert` | Convert Claude Code plugins → 10 platforms (Codex, Copilot, Droid, Gemini, Kiro, OpenClaw, OpenCode, Pi, Qwen, Windsurf) |
| `browse` | Headless browser CLI for QA testing (compiled binary, `bun run build:browse`) |

## State layout

```
.sgc/
├── decisions/{task_id}/
│   ├── intent.md          ← immutable (Invariant §2). Written by /plan (L1+).
│   └── ship.md            ← immutable. Written by /ship (L1+).
├── progress/
│   ├── current-task.md    ← mutable. Active task + last_activity.
│   ├── feature-list.md    ← mutable. Checklist managed by /work.
│   ├── handoff.md         ← session-to-session continuity (manual write).
│   ├── agent-prompts/     ← audit trail. Each spawn writes one prompt file.
│   └── agent-results/     ← audit trail. Mirrors prompts.
├── solutions/{cat}/{slug}.md     ← compound knowledge (delete-forbidden, dedup 0.85).
└── reviews/{task_id}/{stage}/
    └── {reviewer}.md      ← append-only per (task, stage, reviewer) (Invariant §6).
```

## Architecture

```
contracts/                 ← spec source-of-truth (YAML + markdown, human-readable DSL)
├── sgc-capabilities.yaml  ← scope tokens, command permissions, subagent manifests
├── sgc-state.schema.yaml  ← shape + mutability rules per state-layer file
└── sgc-invariants.md      ← 12 non-negotiable rules

src/
├── sgc.ts                 ← citty CLI (8 subcommands)
├── commands/              ← per-command implementations (plan, work, review)
└── dispatcher/
    ├── types.ts           ← TaskId, Level, ScopeToken, IntentDoc, …
    ├── preprocessor.ts    ← DSL → strict YAML (array[T], name?)
    ├── schema.ts          ← cached spec loader
    ├── capabilities.ts    ← scope token computation + Invariant §1 enforcement
    ├── state.ts           ← .sgc/ I/O with mutability rules + atomic writes
    ├── spawn.ts           ← subagent spawn protocol (inline-stub + file-poll modes)
    └── agents/            ← stub agents (classifier-level, planner-eng, reviewer-correctness)

plugins/sgc/               ← Claude Code plugin (skills + agents + hooks, markdown)
└── browse/                ← headless browser source (TypeScript, compiles to single binary)

tests/dispatcher/          ← 107 unit + integration tests (bun test)
docs/                      ← C-phase plan + demo run
```

The skills under `plugins/sgc/skills/{discover,plan,work,review,qa,ship,compound,status,bootstrap}/SKILL.md` are the human-facing prompt layer. Once dispatcher matures, skills will dispatch to `sgc <cmd>` rather than narrate processes inline.

## Invariants enforced today

| § | Rule | Where enforced |
|---|------|----------------|
| 1 | Reviewers/QA cannot read `solutions/` | `capabilities.ts` `forbidden_for` + manifest scope_tokens |
| 2 | Decisions immutable | `state.ts` `writeIntent` / `writeShip` throw on existing |
| 4 | L3 needs human signature | `commands/plan.ts` refuses without `--signed-by` |
| 5 | Reviewer override needs reason ≥40 chars | `state.ts` `appendReview` validates |
| 6 | Reviews append-only per (task,stage,reviewer) | `state.ts` `appendReview` throws on duplicate |
| 7 | Schema validation precedes write | field-presence checks in all writers |
| 8 | Scope tokens pinned at spawn | `spawn.ts` calls `computeSubagentTokens` first |
| 9 | Subagents output only declared shape | `spawn.ts` `validateOutputShape` after stub return |
| 3 | Solutions writes pass dedup | `compound.related` dedup_stamp + `dedup.ts` 0.85 threshold |
| 10 | Compound cluster is a transaction | `runCompound` sequential order — `writeSolution` is the final step; any earlier throw = natural rollback |
| 11 | Classifier rationale must be concrete | `rationale.ts` regex + keyword check post-classifier |
| 6 | Every janitor decision logged | `writeJanitorDecision` after `sgc ship` (including skips) |
| 12 | Eval framework authoritative | `tests/eval/` (L0 + L1 scenarios; 8 more in backlog) |

All 12 invariants now enforced at runtime as of D-phase.

## Test

```bash
bun test tests/             # 308 tests (303 dispatcher + 5 eval), ~650ms
bun test tests/dispatcher/  # unit/integration for each module
bun test tests/eval/        # end-to-end L0/L1 scenarios (Invariant §12)
```

Dispatcher tests (303 across 22 files):
- `preprocessor.test.ts`, `schema.test.ts`, `capabilities.test.ts`, `state.test.ts`, `validation.ts`-driven `spawn.test.ts` — foundations
- `rationale.test.ts` — §11 concrete-reference check
- `sgc-cli.test.ts`, `sgc-plan.test.ts`, `sgc-work.test.ts`, `sgc-review.test.ts` — L0/L1 loop
- `planner-ceo.test.ts`, `researcher-history.test.ts`, `planner-adversarial.test.ts` — L2/L3 cluster
- `qa-browser.test.ts`, `sgc-ship.test.ts`, `gh-runner.test.ts` — qa + ship
- `solutions-state.test.ts`, `compound.test.ts`, `janitor-compound.test.ts` — compound + janitor
- `claude-cli-agent.test.ts`, `anthropic-sdk-agent.test.ts`, `agent-loop.test.ts` — real LLM modes

Eval scenarios (5 tests across 2 files):
- `L0-typo.test.ts` — fast path (no intent, no ship, janitor skip)
- `L1-bugfix.test.ts` — single-file with review + §2/§7/§11 holistic checks

## Agent dispatch modes

SGC supports four agent backends, auto-picked in this order:

| Priority | Mode | When it's picked | Notes |
|----------|------|------------------|-------|
| 1 | `opts.mode` (programmatic) | explicit override | used by tests + embedding |
| 2 | `SGC_AGENT_MODE=<mode>` env | explicit | one of `inline` / `file-poll` / `claude-cli` / `anthropic-sdk` |
| 3 | `SGC_USE_FILE_AGENTS=1` (legacy) | explicit | forces `file-poll` |
| 4 | `inline` stub | caller passes `inlineStub` | tests + demo |
| 5 | `anthropic-sdk` | `ANTHROPIC_API_KEY` present | direct API calls, uses prompt caching, billed to API key |
| 6 | `claude-cli` | `claude` binary in PATH | shells out to `claude -p`, uses your `claude login` (subscription-friendly) |
| 7 | `file-poll` (default) | no key, no CLI | CLI blocks waiting for result file — you submit via `sgc agent-loop --submit <id>` |

**Subscription users** (Claude Pro/Max, no API key): priority 6 activates automatically if `claude` is in PATH. Otherwise you fall back to `file-poll` and submit manually — useful in Claude Code sessions where you can have Claude read + reply in-session.

**API users** (`ANTHROPIC_API_KEY` set): priority 5 activates automatically. Uses `claude-opus-4-6` with adaptive thinking and ephemeral prompt caching.

Override with `SGC_AGENT_MODE=file-poll` at any time to fall back to manual submission (useful for debugging).

## Gotchas

- **`bun install` is slow on this machine**: `bun add` doesn't honor `HTTP_PROXY` env. Use `npm install` instead. `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` skips the 100MB chromium fetch (bring your own at runtime).
- **`bun test` propagates `NODE_ENV=test` to children**, which makes child citty CLIs silence stdout. Spawn helpers in `tests/dispatcher/sgc-cli.test.ts` `delete env.NODE_ENV` to work around.
- **YAML spec uses DSL shorthand**: `array[T]`, `name?` in flow-sequences. Strict `js-yaml.safeLoad` chokes; the dispatcher routes spec through `preprocessor.ts` before parse.

## License

MIT
