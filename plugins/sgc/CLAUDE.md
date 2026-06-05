# SGC

A single engineering workflow combining process discipline, real-world QA, and knowledge compounding.

## Positioning

sgc is a **self-contained engineering super-plugin + knowledge engine** for Claude Code — one-command install, runs standalone (Node ≥ 18, no bun), no other plugins required. See [docs/POSITIONING.md](../../docs/POSITIONING.md) for the full picture.

- **sgc owns + runs natively**: L0-L3 classification, 13 invariants, `.sgc/` state layer, dedup, the compound knowledge loop, review, QA (`qa.browser`; Playwright real-browser opt-in via `--browse`/`SGC_QA_REAL=1`, stub by default — returns `concern`, never rubber-stamps), security review (cso), systematic debugging, ship + canary
- **Optional interop** (richer path if sp/gs installed, never required): deepest plan authoring + full TDD discipline → sp; comprehensive review / browser / deploy → gs
- **Standalone by default**: every command has a working inline implementation; sp/gs are power-ups, not prerequisites

User mental model: sgc is the engineering layer — classifies the task, enforces the protocol, runs review/QA/security/ship, and compounds the knowledge, standalone and from one install. sp/gs are optional power-ups.

## Implementation Status (v1.20.0, GS-N arc complete 7/7 + Tier-1 sp absorb)

The full L0→L3 pipeline is executable end-to-end via `bun src/sgc.ts <cmd>`. All 13 invariants enforced at runtime. The **CE compound-engineering loop is closed end-to-end** (CE-1 prevention injection → CE-2 reflect audit → CE-3 ship-failure capture/promote → CE-4 async plan → CE-5 loop orchestrator → CE-6 `applied_in` L3 + `surfaced_in` L2 score feedback) plus the **GS-N absorb arc complete (7/7)**: canary (GS-1) · handoff (GS-2) · plan fused decision (GS-3) · debug (GS-4) · cso (GS-5) · discover --template (GS-6) · land (GS-7), and the **Tier-1 Superpowers absorb** — `sgc work --done` verification close-gate. See [README.md](../../README.md) for the authoritative 19-command CLI table (16 `/sgc:*` slash commands + 3 CLI-only: `canary` · `watch-ci-failure` · `land`); `sgc doctor` enforces slash↔CLI parity.

| Command | Status | CLI |
|---------|--------|-----|
| `/plan` | ✅ L0-L3 + planner cluster (eng/ceo/adversarial) + researcher.history + CE-4 `--async` | `sgc plan <task> [--motivation\|--signed-by\|--level\|--async]` |
| `/work` | ✅ feature-list tracker + verification close-gate (v1.19.0) + TDD-ledger prior-RED gate (v1.25.0) | `sgc work [--add\|--done <id> --verify-command <s> [--evidence <s>] (--prior-red <s> --red-output <s> \| --waive-red <s>)]` |
| `/review` | ✅ reviewer.correctness on git diff | `sgc review [--base <ref>]` |
| `/qa` | ✅ qa.browser stub by default (concern, never rubber-stamps); Playwright real-browser opt-in (--browse / SGC_QA_REAL=1) | `sgc qa [<target>] [--flows a,b,c]` |
| `/ship` | ✅ 8-gate ship + writeShip + optional `gh pr create` + auto-janitor | `sgc ship [--auto\|--pr\|--no-janitor\|--force-compound]` |
| `/compound` | ✅ 4-agent cluster + dedup + writeSolution; CE-3 `--from-ship-failure` + GS-1.1 `--from-canary` + TDD-ledger `--from-red-green` promote bridges | `sgc compound [--force\|--slug\|--from-ship-failure <s>\|--from-canary <s>\|--from-red-green <s>\|--solution-slug <s>]` |
| `/status` | ✅ active task + level + last_activity | `sgc status` |
| `/agent-loop` | ✅ file-poll submission helper (non-SDK path) | `sgc agent-loop [--list\|--show\|--submit]` |
| `/discover` | ✅ clarifier.discover forcing-questions stub | `sgc discover <topic>` |
| `/tail` | ✅ read `.sgc/progress/events.ndjson` (Invariant §13 stream) | `sgc tail [--task\|--agent\|--event-type\|--since\|--follow\|--limit]` |
| `/reflect` | ✅ CE-2 decisions↔solutions audit; CE-6 surfaces `applied: N` + `surfaced: N` | `sgc reflect [--task\|--since\|--save\|--json]` |
| `/loop` | ✅ CE-5 end-to-end orchestrator (plan→work→review→qa→ship→compound) | `sgc loop <task> [--resume\|--runs\|--status]` |
| `watch-ci-failure` (CLI-only) | ✅ CE-3 publish-CI poller → templated `.sgc/ship-failures/<sha>.md` | `sgc watch-ci-failure [--run-id\|--workflow]` |
| `canary` (CLI-only) | ✅ GS-1 post-publish health check (npm_propagation → smoke_install → health_url) | `sgc canary [--package\|--version\|--phases\|--health-url\|--health-regex\|--interval\|--timeout\|--bin]` |
| `land` (CLI-only) | ✅ GS-7 post-publish ship chain (watch-ci-failure + canary, fail-fast) | `sgc land [--package\|--version]` |
| `/debug` | ✅ GS-4 4-phase systematic-debugging walker; `close` is an Iron Law #3 hard-gate | `sgc debug <start\|close> [--id\|--root-cause\|--fix-commit\|--verify-command\|--runs\|--status]` |
| `/handoff` | ✅ GS-2 session-state checkpoint → `tasks/<slug>-paused.md` | `sgc handoff [--auto\|--print <slug>]` |
| `/cso` | ✅ GS-5 pre-ship security review (secret scan + dep audit + event anomalies) | `sgc cso` |
| `/doctor` | ✅ contracts/prompts/manifest consistency + slash↔CLI parity check | `sgc doctor` |

Agent modes (auto-detected per priority):
  `ANTHROPIC_API_KEY` set → anthropic-sdk (SDK + prompt caching)
  `claude` in PATH → claude-cli (subscription-friendly shell-out)
  inlineStub provided → inline (tests + MVP heuristic stubs)
  default → file-poll (manual submission via `sgc agent-loop`)

## Commands

| Command | Purpose |
|---------|---------|
| `/discover` | Clarify requirements before planning |
| `/plan <task>` | Classify task level, run appropriate reviewers, produce intent (CE-4 `--async` forks detached) |
| `/work` | Execute plan with task tracking, TDD, worktree isolation |
| `/review` | Independent static review with reviewer cluster |
| `/qa <target>` | Browser QA gate — Playwright real-browser opt-in (--browse / SGC_QA_REAL=1); stub by default (concern, never rubber-stamps) |
| `/ship` | Ship gate: verify evidence, deploy, trigger compound decision |
| `/compound` | Extract and store knowledge; CE-3 `--from-ship-failure` + GS-1.1 `--from-canary` promote captured failures |
| `/status` | Show current task state, decisions history, knowledge stats |
| `/agent-loop` | File-poll fulfillment helper for external Claude session (`--list / --show / --submit`) |
| `/tail` | Stream `.sgc/progress/events.ndjson` (Invariant §13 two-tier audit) |
| `/reflect` | CE-2 audit: which solutions/ preventions surfaced in intent.md discussions (CE-6 `applied: N` + `surfaced: N`) |
| `/metrics` | Four-化 product self-scorecard (read-only) |
| `/loop` | CE-5 orchestrator: plan→work→review→qa→ship→compound with manual gates |
| `/debug` | GS-4: 4-phase systematic-debugging walker (investigate → analyze → hypothesize → implement); `close` is an Iron Law #3 hard-gate |
| `/cso` | GS-5: pre-ship security review — secret scan + dependency audit + event-stream anomaly detection |
| `/handoff` | GS-2: session-state checkpoint → `tasks/<slug>-paused.md` for post-compaction recovery |
| `/doctor` | Consistency check across contracts/sgc-capabilities.yaml ↔ prompts/ ↔ slot annotations ↔ slash↔CLI parity |
| `watch-ci-failure` (CLI-only) | CE-3: poll publish CI for current branch HEAD; on failure write templated `.sgc/ship-failures/<sha>.md` |
| `canary` (CLI-only) | GS-1: post-publish health check (npm propagation → npx smoke → optional health URL) |
| `land` (CLI-only) | GS-7: post-publish ship chain (watch-ci-failure + canary, fail-fast) |

## State Layer (.sgc/)

All persistent state lives under `.sgc/` in the project root. Four directories, each with single ownership:

```
.sgc/
  decisions/{task_id}/intent.md, ship.md   — append-only, immutable after creation
  progress/current-task.md, handoff.md     — mutable scratch, overwritten per task
  solutions/{category}/{slug}.md           — compound knowledge, dedup-enforced
  reviews/{task_id}/{stage}/{reviewer}.md  — append-only audit trail
```

### Permission Matrix

| Command | decisions | progress | solutions | reviews |
|---------|-----------|----------|-----------|---------|
| /discover | — | R | — | — |
| /plan | R+W | RW | R | R |
| /work | R | RW | R | — |
| /review | R | R | **FORBIDDEN** | W |
| /qa | R | R | **FORBIDDEN** | W |
| /ship | R+W | R | — | RW |
| /compound | R | R | RW | R |
| /status | R | R | R | R |

**CRITICAL**: `/review` and `/qa` MUST NOT read `solutions/`. This prevents confirmation bias — reviewers must judge independently without historical memory. See Invariant §1.

## Task Levels (L0–L3)

Every task entering `/plan` is classified by level. The level determines the review depth.

| Level | Scope | Planning | Review | Compound |
|-------|-------|----------|--------|----------|
| L0 | Trivial (typo, format, config) | Skip all — direct to /work | None | Skip |
| L1 | Single file, <50 lines, no behavior change | planner.eng light review | 2 reviewers | Janitor decides |
| L2 | Multi-file OR behavior change OR tests needed | planner.ceo + planner.eng + researcher.history | 6 fixed reviewers | Janitor decides |
| L3 | Architecture, DB schema, prod infra | L2 + planner.adversarial + human signature | 6 + conditional (max 10) | Always compound |

**Behavior change (Δbehavior)**: any externally observable contract change — API response, CLI output, config semantics, error codes, perf thresholds, security model.

**Escalation rules**:
- Uncertain level → escalate up
- Public API / auth / payment → minimum L2
- Migration / infra → minimum L3
- L3 **forbids --auto** at all stages — human must confirm

## Invariants (Non-Negotiable)

These rules cannot be overridden by any instruction:

1. **Generator-Evaluator Separation**: Reviewers and QA agents MUST NOT read solutions/. No exceptions.
2. **Decisions Are Immutable**: Once intent.md is written, it cannot be edited. Changed intent → new task.
3. **Solutions Require Dedup**: No write to solutions/ without compound.related running first. Similarity threshold 0.85, not tunable.
4. **L3 Forbids --auto**: Any L3 command with --auto is refused. Human signature required.
5. **Reviewer Override Requires Human**: When a reviewer returns fail and ship proceeds, override must include human signature + reason (≥40 chars).
6. **Audit-Trail Writes Are Durable**: Janitor decisions are logged (even skips → reviews/{task_id}/janitor/) AND review/qa/cso reports are append-only. Silent skips forbidden.
7. **Schema Validation on Every Write**: All writes to .sgc/ are validated against schema before commit. No lenient mode.
8. **Scope Tokens Computed At Spawn**: A subagent's capabilities are pinned at spawn from the permission matrix; no runtime elevation. Out-of-scope file/git/spawn access terminates it.
9. **No Writes Outside Declared Outputs**: The dispatcher discards any subagent output that doesn't match its manifest `outputs` shape.
10. **Compound Is All-Or-Nothing**: If any compound substep fails or times out, the whole compound rolls back — no partial solutions/ write.
11. **Classifier Must Justify**: classifier.level must emit a rationale referencing a concrete task feature; empty/generic rationales are refused.
12. **Evaluation Framework Is Authoritative**: When spec and the eval framework disagree, the framework wins; a new invariant ships with its regression test in the same commit.
13. **Spawn + LLM Event Audit (two-tier)**: Every spawn emits paired spawn.start/end (all modes); LLM-backed modes also emit llm.request/response. Guaranteed via try/finally. Infra-level sink-write failure is exempt.

## Flow Rules

### Before Implementation (L2+)
- Clarify requirements before planning — ask forcing questions, don't assume
- Write a plan before execution — every step should have concrete code, not placeholders
- Plans output to progress/feature-list.md as a checklist

### During Implementation
- **TDD**: Write failing test first, then minimal implementation, then refactor. No production code without a test.
- **Systematic Debugging**: 4 phases — (1) investigate root cause, (2) pattern analysis, (3) hypothesis, (4) fix. No guessing.
- **Worktree Isolation**: For L2+ tasks, use git worktrees to avoid polluting the main branch.
- **Parallel Agents**: For 2+ independent subtasks, dispatch parallel agents. One agent per problem domain.

### After Implementation
- **Evidence Before Completion**: Before claiming done, collect verifiable evidence — test results, screenshots, QA reports.
- **Independent Review**: Author and reviewer MUST be in separate contexts. Claude cannot review its own code in the same session.
- **Verification**: Run the actual tests, check the actual output. "Looks correct" is not evidence.

## Automation Tiers

| Tier | Default | Override | Examples |
|------|---------|----------|----------|
| Mechanical | Auto, no interruption | None | State file I/O, reviewer spawn, L0 full flow |
| Decision | Confirm first | `--auto` skips | Level classification, compound trigger, L2 ship |
| Forced | Always human | **No override** | L3 ship, solutions deletion, reviewer fail override |

## Reviewer Cluster

`/review` dispatches reviewers based on task level:

- **L0/L1/L2**: `reviewer.correctness` (single-reviewer MVP — full L2 cluster of 6 manifested for forward-compat but not yet wired)
- **L3**: `reviewer.correctness` + diff-conditional specialists (parallel)

L3 diff-conditional specialists (implemented, see `src/dispatcher/agents/reviewer-specialists.ts`):
- security (auth · jwt · token · session · crypto · password · secret · signature · encrypt/decrypt) — severity medium
- migration (migration · ALTER/DROP/CREATE TABLE · ALTER/RENAME COLUMN · backfill) — severity high
- performance (perf · cache · memoize · index · benchmark · n+1 · O(n) · p95/p99) — severity medium
- infra (Dockerfile · FROM · kubectl · k8s · terraform · helm · fly.toml · vercel.json · render.yaml · github/workflows) — severity high

Aggregate verdict = worst-of across all spawned reviewers (`pass < concern < fail`). Each report is append-only per (task, stage, reviewer) per Invariant §6.

## Compound Janitor

After every `/ship`, `janitor.compound` runs automatically and decides:

**Skip if**:
- Level is L0
- diff < 20 lines AND no reviewer flagged "novel"
- Existing solution with similarity > 0.85 (routes to update-existing)
- Task failed with no new knowledge

**Compound if**:
- Any reviewer severity ≥ medium
- Level ≥ L2 AND shipped successfully
- Novel bug signature not in solutions/ index
- User forced with `--force`

**Default**: skip (conservative — missing a compound is recoverable, polluting solutions/ is not)

## Guardrails

Intercept and warn before executing:
- `rm -rf` with variables or broad paths
- `DROP TABLE`, `DELETE FROM` without WHERE
- `git push --force`, `git reset --hard`
- `git checkout .`, `git restore .` (discards uncommitted changes)
- Plaintext secrets in code, logs, or commits

Refuse without override:
- Disabling SSL verification
- Running unknown remote scripts
- Committing .env or credentials files

## Agent Namespacing

When dispatching agents from skills, use fully-qualified names:
`sgc:category:agent-name` (e.g., `sgc:reviewer:correctness`)
