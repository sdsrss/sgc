# SGC — Unified Engineering Agent

A single Claude Code workflow combining process discipline (Superpowers), real-world QA + ship pipeline (gstack), and knowledge compounding (Compound Engineering). One CLI, one state layer, one set of invariants.

**Status**: dispatcher MVP — L1 closed loop executable. L2/L3 clusters, compound, qa.browser, ship are stubs. See [docs/c-phase-dispatcher.md](docs/c-phase-dispatcher.md) for roadmap.

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
bun src/sgc.ts plan "add an Example section to plan/SKILL.md"

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
| `sgc plan <task>` | ✅ | Classify L0-L3, run planners, write `decisions/{id}/intent.md` (immutable) |
| `sgc work [--add\|--done]` | ✅ | Track `feature-list.md` progress |
| `sgc review [--base <ref>]` | ✅ | Reviewer.correctness on git diff → `reviews/{id}/code/correctness.md` |
| `sgc status` | ✅ | Show active task + level + last activity |
| `sgc discover <topic>` | ⏸ stub | Requirements clarification |
| `sgc qa <target>` | ⏸ stub | Real-browser QA via the bundled `browse` binary |
| `sgc ship` | ⏸ stub | Ship gate + janitor.compound trigger |
| `sgc compound` | ⏸ stub | Knowledge dedup + write to `solutions/` |

Two more CLIs from the same repo:

| Command | Purpose |
|---------|---------|
| `sgc-convert` | Convert Claude Code plugins → 10 platforms (Codex, Copilot, Droid, Gemini, Kiro, OpenClaw, OpenCode, Pi, Qwen, Windsurf) |
| `browse` | Headless browser CLI for QA testing (compiled binary, `bun run build:browse`) |

## State layout

```
.sgc/
├── decisions/{task_id}/
│   ├── intent.md          ← immutable (Invariant §2). Written by /plan.
│   └── ship.md            ← immutable. Written by /ship (when implemented).
├── progress/
│   ├── current-task.md    ← mutable. Active task + last_activity.
│   ├── feature-list.md    ← mutable. Checklist managed by /work.
│   ├── handoff.md         ← session-to-session continuity (manual write).
│   ├── agent-prompts/     ← audit trail. Each spawn writes one prompt file.
│   └── agent-results/     ← audit trail. Mirrors prompts.
├── solutions/{cat}/{slug}.md     ← compound knowledge (D-phase).
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

§3 (dedup), §10 (compound transaction), §11 (classifier rationale required), §12 (eval framework authoritative) — D-phase.

## Test

```bash
bun test tests/dispatcher/    # 107 tests, ~500ms
```

Coverage:
- `preprocessor.test.ts` (13) — DSL transformations + idempotency
- `schema.test.ts` (12) — cache, manifest lookups, YAML anchor expansion
- `capabilities.test.ts` (25) — pattern match, forbidden_for, computeCommandTokens, canSpawn
- `state.test.ts` (19) — mutability, schema validate, atomic writes
- `spawn.test.ts` (5) — inline-stub + file-poll modes, OutputShapeMismatch, SpawnTimeout
- `sgc-cli.test.ts` (7) — CLI smoke + status states
- `sgc-plan.test.ts` (8) — full L0-L3 classification + L3 signature gate
- `sgc-work.test.ts` (8) — feature-list mutations
- `sgc-review.test.ts` (10) — reviewer stub + full review flow + append-only

## Gotchas

- **`bun install` is slow on this machine**: `bun add` doesn't honor `HTTP_PROXY` env. Use `npm install` instead. `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` skips the 100MB chromium fetch (bring your own at runtime).
- **`bun test` propagates `NODE_ENV=test` to children**, which makes child citty CLIs silence stdout. Spawn helpers in `tests/dispatcher/sgc-cli.test.ts` `delete env.NODE_ENV` to work around.
- **YAML spec uses DSL shorthand**: `array[T]`, `name?` in flow-sequences. Strict `js-yaml.safeLoad` chokes; the dispatcher routes spec through `preprocessor.ts` before parse.

## License

MIT
