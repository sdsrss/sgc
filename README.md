# SGC — Spec Layer + Knowledge Engine

L0-L3 task classification, 13 runtime invariants, and a dedup-enforced `.sgc/` knowledge base. A **规范层 + 知识引擎** that *coexists* with `superpowers` (sp) and `gstack` (gs) rather than replacing them — sgc owns classification + invariants + the solutions corpus; sp owns deep planning / TDD / debugging; gs owns ship + browser QA + deploy. See [docs/POSITIONING.md](docs/POSITIONING.md) for the delegate pattern.

**Status**: v1.10.0 — full L0→L3 pipeline with 14 CLI commands, 10 LLM-backed agents (`prompt_path` templates with `cache_control` split), 1 intentionally heuristic (`compound.related` — its `dedup_stamp` authorizes Invariant §3 writes and must stay deterministic), all 13 invariants enforced at runtime, plus the **CE compound-engineering loop end-to-end** (CE-1 prevention injection → planner.adversarial; CE-2 `sgc reflect` decisions↔solutions audit; CE-3 `sgc watch-ci-failure` + `sgc compound --from-ship-failure` ship-failure capture/promote; CE-4 `sgc plan --async` detached planner; CE-5 `sgc loop` orchestrator; CE-6 `applied_in` score feedback to source solutions). LLM integration via `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY` / local `claude` binary — auto-detected per `resolveMode` priority. See [CHANGELOG.md](CHANGELOG.md) for shipped phases and [docs/c-phase-dispatcher.md](docs/c-phase-dispatcher.md) for the build history.

---

## Install

sgc has two pieces: the **CLI** (the dispatcher) and the **Claude Code plugin** (the markdown prompt layer that invokes the CLI from `/sgc:*` slash commands).

### 1. Install the CLI

**Recommended — npm (global):**

```bash
npm install -g @sdsrs/sgc
sgc --version
```

`bun ≥ 1.3` is required as the runtime — `bun --version` to verify. Once installed, `/sgc:*` commands work from any project directory.

**Alternative — from source** (when you want to hack on sgc itself or the npm registry is unreachable):

```bash
git clone https://github.com/sdsrss/sgc && cd sgc

# bun client doesn't honor HTTP_PROXY; use npm for install
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install

bun --version    # ≥1.3
```

In source-clone mode, `/sgc:*` commands must run from inside the `sgc/` directory (each slash command preflight detects npm-installed first, then falls back to checking `src/sgc.ts` in `cwd`). Lockfile: `package-lock.json` (npm); Bun reads it fine.

### 2. Install the Claude Code plugin

```bash
/plugin marketplace add sdsrss/sgc
/plugin install sgc
```

Installs the prompt layer in `~/.claude/plugins/cache/sgc/sgc/`: 11 slash commands (`/sgc:plan`, `/sgc:work`, `/sgc:doctor`, …), 9 skills, and the SessionStart bootstrap hook. After install, `/sgc:plan` etc. become available in any Claude Code session — the slash command auto-detects whichever CLI install you have.

## Update

```bash
# Plugin layer
/plugin marketplace update sgc    # refresh marketplace metadata
/plugin update sgc                # pull the new plugin version

# CLI — npm install
npm update -g @sdsrs/sgc

# CLI — source clone
git pull && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install
```

Both plugin steps are needed — `/plugin update sgc` alone uses cached marketplace metadata and won't see new versions. The plugin update only refreshes the markdown prompt layer, not the dispatcher; bump the CLI separately via the matching method.

## Uninstall

```bash
/plugin uninstall sgc               # removes plugin from ~/.claude/plugins/cache
/plugin marketplace remove sgc      # removes the marketplace entry
```

Both steps for a clean removal. Project-level `.sgc/` state directories are **not** touched — that's project data, not plugin data. Run `rm -rf .sgc` per-project if you also want to wipe the state layer.

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
| `sgc compound [--force\|--slug\|--from-ship-failure <slug>]` | ✅ | 4-agent compound cluster + dedup (0.85 threshold) + write `solutions/{cat}/{slug}.md`. CE-3: `--from-ship-failure` promotes a captured ship-failure record through the same Invariant §3 write-gate. |
| `sgc status` | ✅ | Active task + level + last activity |
| `sgc agent-loop [--list\|--show\|--submit]` | ✅ | File-poll fulfillment helper (for external Claude session) |
| `sgc discover <topic>` | ✅ | clarifier.discover forcing-questions; feeds into `sgc plan --motivation` |
| `sgc tail [--task\|--agent\|--event-type\|--since\|--follow\|--limit]` | ✅ | Read `.sgc/progress/events.ndjson` (Invariant §13 two-tier audit stream); `--follow` polls with rotation handling |
| `sgc plan --async <task>` | ✅ | CE-4: fork detached planner cluster, return job handle in <100ms. Surfaces via `sgc plan --jobs` / `--status <id>`. Single active job per project enforced. |
| `sgc reflect [--task\|--since\|--save\|--json]` | ✅ | CE-2: read-only audit of `.sgc/decisions/*/intent.md` against `.sgc/solutions/*/*.md` `prevention:` field; classifies each match as `discussed` or `silent`. CE-6 surfaces `applied: N` per candidate. |
| `sgc loop <task> [--resume <run-id>\|--runs\|--status]` | ✅ | CE-5: end-to-end orchestrator chaining `plan → [pause work] → review → qa → [pause ship] → compound`. Manual gates at `work` and `ship`; `--resume` continues from paused/failed step. L0 auto-skips review/qa/ship/compound. |
| `sgc watch-ci-failure [--run-id <id>\|--workflow <name>]` | ✅ | CE-3: poll publish CI for current branch HEAD; on `failure`, write templated record at `.sgc/ship-failures/<date>-<sha>.md` with `prevention_seed: "TODO …"` for operator to fill. Pairs with `sgc compound --from-ship-failure` to promote. |
| `sgc doctor` | ✅ | Consistency check across `contracts/sgc-capabilities.yaml` ↔ `prompts/` ↔ slot-only annotations. Exit 1 on any failure. |

One more CLI from the same repo:

| Command | Purpose |
|---------|---------|
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

### Storage model — operator-local by design

`.sgc/` is **gitignored** and lives per-project, per-machine. `solutions/` is the knowledge corpus that `researcher.history` mines, and it accumulates on whichever machine runs `sgc compound`. There is **no built-in team-sync** today — cross-machine and cross-teammate continuity is a future-work item.

If you want continuity across machines or with a teammate, the manual workaround is to version `.sgc/solutions/` into a private side repo (push from machine A, pull on machine B). A native `sgc solutions sync` command + opinionated local/team partition is on the roadmap once the right partition shape emerges from real usage; see review notes for the design space (local/team split vs `sgc solutions sync` vs SQLite backend).

## Architecture

```
contracts/                 ← spec source-of-truth (YAML + markdown, human-readable DSL)
├── sgc-capabilities.yaml  ← scope tokens, command permissions, subagent manifests
├── sgc-state.schema.yaml  ← shape + mutability rules per state-layer file
└── sgc-invariants.md      ← 12 non-negotiable rules

src/
├── sgc.ts                 ← citty CLI (9 subcommands)
├── commands/              ← per-command implementations (discover/plan/work/review/qa/ship/compound/agent-loop; status inline in sgc.ts)
└── dispatcher/
    ├── types.ts           ← TaskId, Level, ScopeToken, IntentDoc, …
    ├── preprocessor.ts    ← DSL → strict YAML (array[T], name?)
    ├── schema.ts          ← cached spec loader
    ├── capabilities.ts    ← scope token computation + Invariant §1 enforcement
    ├── state.ts           ← .sgc/ I/O with mutability rules + atomic writes
    ├── spawn.ts           ← subagent spawn protocol (inline-stub + file-poll + claude-cli + anthropic-sdk)
    ├── dedup.ts           ← signature + Jaccard similarity (Invariant §3)
    └── agents/            ← stub agents for all 20 manifested subagents

plugins/sgc/               ← Claude Code plugin (skills + agents + hooks, markdown)
└── browse/                ← headless browser source (TypeScript, compiles to single binary)

tests/dispatcher/          ← unit + integration tests (bun test)
tests/eval/                ← 8 end-to-end scenarios per Invariant §12
docs/                      ← C-phase plan + demo run
```

The skills under `plugins/sgc/skills/{discover,plan,work,review,qa,ship,compound,status,bootstrap}/SKILL.md` are the human-facing prompt layer. Once dispatcher matures, skills will dispatch to `sgc <cmd>` rather than narrate processes inline.

## Invariants enforced today

| § | Rule | Where enforced | Trust model |
|---|------|----------------|-------------|
| 1 | Reviewers/QA cannot read `solutions/` | `capabilities.ts` `forbidden_for` + manifest `scope_tokens` — the manifest declaration is validated at every spawn | **advisory for real-LLM modes** (see below) |
| 2 | Decisions immutable | `state.ts` `writeIntent` / `writeShip` throw on existing | filesystem-enforced |
| 3 | Solutions writes pass dedup | `state.ts` `writeSolution` requires `DedupStamp` produced by a prior `compound.related` spawn — direct write without stamp throws `DedupStampMissing` | filesystem-enforced |
| 4 | L3 needs human signature + interactive yes | `commands/plan.ts` + `commands/ship.ts` refuse without `--signed-by` AND stdin `yes`; `--auto` refused | flag-enforced |
| 5 | Reviewer override needs reason ≥40 chars | `state.ts` `appendReview` validates | filesystem-enforced |
| 6 | Every janitor decision logged | `writeJanitorDecision` always; `--janitor-skip-reason "<≥40 chars>"` still writes a synthetic skip decision | flag-enforced |
| 7 | Schema validation precedes write | field-presence + dedup-stamp checks in all writers | filesystem-enforced |
| 8 | Scope tokens pinned at spawn | `spawn.ts` calls `computeSubagentTokens` first; pinned set written to prompt audit | **advisory for real-LLM modes** (see below) |
| 9 | Subagents output only declared shape | `spawn.ts` `validateOutputShape` after agent output (rejects undeclared fields and type-mismatches) | filesystem-enforced |
| 10 | Compound cluster is a transaction | `runCompound` sequential — `writeSolution` is the final step; earlier throw = no write; `forceError` test hook exercises this | filesystem-enforced |
| 11 | Classifier rationale must be concrete | `rationale.ts` regex check post-classifier; refuses generic rationales | flag-enforced |
| 12 | Eval framework authoritative | `tests/eval/` (L0 + L1; 8 more in backlog per D-dec-6) | eval-authored |

### Trust model — real-LLM modes

§1 (reviewers no `read:solutions`) and §8 (scope pinned at spawn) are **fully enforced only in `inline` mode** — the in-process stubs can only do what their code permits, and `validateOutputShape` filters their output.

In **`claude-cli`** and **`anthropic-sdk`** modes the LLM is free to use whatever tools its runtime grants it. sgc embeds the pinned tokens + forbidden-tokens list in the prompt, but that's **advisory**. A malicious or confused LLM running under `claude-cli` could, for example, `bash cat /.sgc/solutions/*.md` — no sandbox is applied. A production deployment that needs §1/§8 runtime-enforced against an arbitrary LLM response would need either:

- a filesystem sandbox around the spawned `claude` process, or
- a follow-up validator that diff-checks the LLM's observable actions against the pinned scope

Both are E-phase concerns. Today: if you need ironclad §1/§8, run in `inline` mode (stubs) or dispatch to a Claude main session via `file-poll` where you manually review what the agent produces before submitting via `sgc agent-loop`.

## Test

```bash
bun test tests/dispatcher tests/eval     # 357 tests across 32 files, ~700ms
```

CI runs the same on every push/PR via [`.github/workflows/test.yml`](.github/workflows/test.yml).

Dispatcher tests (24 files):
- `preprocessor.test.ts`, `schema.test.ts`, `capabilities.test.ts`, `state.test.ts`, `spawn.test.ts` — foundations
- `rationale.test.ts` — §11 concrete-reference check
- `sgc-cli.test.ts`, `sgc-plan.test.ts`, `sgc-work.test.ts`, `sgc-review.test.ts`, `sgc-discover.test.ts` — command loop
- `planner-ceo.test.ts`, `researcher-history.test.ts`, `planner-adversarial.test.ts`, `clarifier-discover.test.ts` — agent cluster
- `qa-browser.test.ts`, `sgc-ship.test.ts`, `gh-runner.test.ts` — qa + ship
- `solutions-state.test.ts`, `compound.test.ts`, `janitor-compound.test.ts` — compound + janitor
- `claude-cli-agent.test.ts`, `anthropic-sdk-agent.test.ts`, `agent-loop.test.ts` — real LLM modes

Eval scenarios (8 files per Invariant §12):
- `L0-typo.test.ts`, `L1-bugfix.test.ts`, `L2-cross-file.test.ts`, `L3-migration.test.ts` — full pipeline by level
- `qa-browser.test.ts`, `compound-happy.test.ts`, `dedup.test.ts`, `reviewer-isolation.test.ts` — invariant + supporting-agent

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
