# SGC

A single engineering workflow combining process discipline, real-world QA, and knowledge compounding.

## Positioning

sgc is a **规范层 + 知识引擎** that coexists with `superpowers` (sp) and `gstack` (gs). See [docs/POSITIONING.md](../../docs/POSITIONING.md) for the full delegate pattern.

- **sgc owns**: L0-L3 classification, 12 invariants, `.sgc/` state layer, dedup, compound, solutions/
- **sgc delegates** (when sp/gs present): deep plan body, TDD, debugging, pre-ship review, git/PR/deploy, browser QA
- **sgc falls back** (when sp/gs absent): current inline implementations

User mental model: sgc decides the level, enforces the protocol, records the knowledge. sp does the thinking. gs ships.

## Implementation Status (v1.1, D-phase complete)

The full L0→L3 pipeline is executable end-to-end via `bun src/sgc.ts <cmd>`. All 12 invariants enforced at runtime. See [README.md](../../README.md) for the command table and [docs/c-phase-demo.md](../../docs/c-phase-demo.md) for a worked run.

| Command | Status | CLI |
|---------|--------|-----|
| `/plan` | ✅ L0-L3 + planner cluster (eng/ceo/adversarial) + researcher.history | `sgc plan <task> [--motivation\|--signed-by\|--level]` |
| `/work` | ✅ feature-list tracker | `sgc work [--add\|--done <id>]` |
| `/review` | ✅ reviewer.correctness on git diff | `sgc review [--base <ref>]` |
| `/qa` | ✅ qa.browser stub; real browse binary opt-in | `sgc qa [<target>] [--flows a,b,c]` |
| `/ship` | ✅ 8-gate ship + writeShip + optional `gh pr create` + auto-janitor | `sgc ship [--auto\|--pr\|--no-janitor\|--force-compound]` |
| `/compound` | ✅ 4-agent cluster + dedup + writeSolution | `sgc compound [--force\|--slug]` |
| `/status` | ✅ active task + level + last_activity | `sgc status` |
| `/agent-loop` | ✅ file-poll submission helper (non-SDK path) | `sgc agent-loop [--list\|--show\|--submit]` |
| `/discover` | ✅ clarifier.discover forcing-questions stub | `sgc discover <topic>` |

Agent modes (auto-detected per priority):
  `ANTHROPIC_API_KEY` set → anthropic-sdk (SDK + prompt caching)
  `claude` in PATH → claude-cli (subscription-friendly shell-out)
  inlineStub provided → inline (tests + MVP heuristic stubs)
  default → file-poll (manual submission via `sgc agent-loop`)

## Commands

| Command | Purpose |
|---------|---------|
| `/discover` | Clarify requirements before planning |
| `/plan <task>` | Classify task level, run appropriate reviewers, produce intent |
| `/work` | Execute plan with task tracking, TDD, worktree isolation |
| `/review` | Independent static review with reviewer cluster |
| `/qa <target>` | Real browser end-to-end testing |
| `/ship` | Ship gate: verify evidence, deploy, trigger compound decision |
| `/compound` | Extract and store knowledge (usually auto-triggered by janitor) |
| `/status` | Show current task state, decisions history, knowledge stats |

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
6. **Every Janitor Decision Is Logged**: Even skip decisions must be written to reviews/{task_id}/janitor/. Silent skips are forbidden.
7. **Schema Validation on Every Write**: All writes to .sgc/ are validated against schema before commit. No lenient mode.

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
