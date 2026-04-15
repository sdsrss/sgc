# C-Phase: Dispatcher MVP

Source of truth for C-phase implementation. Every commit references a Step number below.

## Goal

Build the minimum viable dispatcher that turns the markdown spec (skills, agents, contracts) into an executable system. MVP scope = run an **L1 task end-to-end** with state files validated and capabilities enforced.

**Not in MVP**: L2/L3 (multi-planner, adversarial, human signature), compound (dedup + 5-agent cluster), janitor auto-decision, qa.browser (browse integration), ship flow, L3 specialist reviewers.

## Decisions Locked

| # | Decision | Choice |
|---|----------|--------|
| 1 | src/ retained | bin renamed to `sgc-convert`; `sgc` reserved for dispatcher |
| 2 | release scripts | deleted (deferred to publish phase) |
| 3 | broken browse tests | deleted (gstack vestiges); 38→33 |
| 4 | lockfile | `package-lock.json` (npm); bun is runtime only |
| 5 | AGENTS.md | symlink → CLAUDE.md |
| 6 | `plugins/sgc/bin/` | skipped |
| 7 | level rule | upgrade-only (never downgrade) |
| 8 | manifest key format | short: `reviewer.correctness:` (dispatcher maps `sgc:X:Y` ↔ `X.Y`) |
| 9 | YAML DSL shorthand | preprocessor normalizes before parse |
| 10 | dispatcher location | `src/dispatcher/` |
| 11 | dispatcher entry | citty CLI: `bun run sgc <cmd>` |
| 12 | MVP scope | L0/L1 chain only |
| 13 | first demo task | L1 (modify `plan/SKILL.md` example section) |
| 14 | stub agent form | file I/O: dispatcher writes prompt file, waits for result file |

## Agent Prompt I/O Protocol

For stub agents (MVP), dispatcher and agent communicate via file pair:

```
.sgc/progress/agent-prompts/{spawn_id}.md   ← dispatcher writes prompt (with input + scope_token list + expected output schema)
.sgc/progress/agent-results/{spawn_id}.md   ← agent writes result (matching declared output schema)
```

`spawn_id` = `{ulid}-{agent_name}` (e.g. `01HXXX-classifier.level`).

Dispatcher polls for result file (timeout = `subagents.{name}.timeout_s` from capabilities.yaml). On result arrival: validate against `outputs` schema → either pass to next stage or reject with `OutputShapeMismatch` error.

This file-based protocol replaces a real subagent spawn for MVP. Future D-phase: swap file polling for actual `Task(...)` invocation; agent code unchanged.

## Step-by-Step

### Step 1 — Foundation (3 commits)

#### C-1.1: types.ts + preprocessor.ts
- `src/dispatcher/types.ts`: `TaskId` (ULID), `Level` (`L0|L1|L2|L3`), `ScopeToken` (string), `IntentDoc`, `FeatureList`, `ReviewReport`, `JanitorDecision`, `SubagentManifest`.
- `src/dispatcher/preprocessor.ts`:
  - Input: raw YAML string.
  - Output: strict-parseable YAML string.
  - Transformations:
    - `array[T]` → `{type: array, items: {type: T}}` (T may be primitive or `{...}`)
    - `enum[A, B, C]` → `{type: string, enum: [A, B, C]}`
    - `enum[A]` (single) → same
    - Trailing `?` on field name → strip `?`, mark field as `optional: true`
    - `array[{a, b}]` → array with object-shape items (use anchor)
  - Idempotent: running it twice produces same output.
- Test: round-trip `sgc-capabilities.yaml` and `sgc-state.schema.yaml` through preprocessor → strict YAML parse succeeds.

#### C-1.2: schema.ts + capabilities.ts
- `src/dispatcher/schema.ts`: load (preprocessor + safe_load) the 2 contract YAML files at module init. Cache. Expose:
  - `getStateFileSchema(stateLayer, fileType)` → typebox schema
  - `getSubagentManifest(name)` → `SubagentManifest`
  - `getCommandPermissions(cmd)` → `{decisions, progress, solutions, reviews, exec, spawn}`
- `src/dispatcher/capabilities.ts`:
  - `computeScopeTokens(command, subagent?)`: returns the pinned token set.
  - `assertScope(tokens, requestedOp)`: throws `ScopeViolation` if op not allowed.
  - `forbidden_for` patterns enforced (e.g. `reviewer.*` cannot hold `read:solutions`).

#### C-1.3: state.ts
- `src/dispatcher/state.ts`:
  - `readState(layer, taskId, file)` → typed object
  - `writeState(layer, taskId, file, content, {append, immutable})`:
    1. Schema-validate content against `getStateFileSchema(...)`
    2. If `immutable` and file exists → throw `IntentImmutable`
    3. If `append` → append; else write
    4. Atomic write (tempfile + rename)
  - `ensureSgcStructure()`: create `.sgc/{decisions,progress,solutions,reviews}/` if missing.

### Step 2 — CLI skeleton (1 commit)

#### C-2.1: src/sgc.ts + bin
- `src/sgc.ts`: citty `defineCommand` with subcommands `plan|work|review|status|discover|qa|ship|compound`.
- All subcommands except `status` initially throw `NotImplementedYet` with helpful message.
- `package.json` add `"sgc": "./src/sgc.ts"` to `bin`.
- Verify: `bun run src/sgc.ts --help` lists 8 subcommands.

### Step 3 — L1 closed loop (4 commits)

#### C-3.1: sgc status
- `sgc status`: read `.sgc/progress/current-task.md` (if exists), list active task + level + last activity. Output table to stdout.
- No write capability. Smoketest for state.ts.

#### C-3.2: sgc plan
- `sgc plan "<task description>"`:
  1. ensureSgcStructure() if needed
  2. Generate `task_id` (ULID)
  3. Spawn `classifier.level` (file-protocol stub) → wait for result with `level + rationale + affected_readers`
  4. Present classification to user; if user disagrees, allow upgrade (not downgrade per decision #7)
  5. If level >= L1: spawn `planner.eng` (stub) → wait for `feature_list`
  6. Write `.sgc/decisions/{task_id}/intent.md` (immutable)
  7. Write `.sgc/progress/feature-list.md` (mutable)
  8. Update `.sgc/progress/current-task.md`
  9. Print "Run `sgc work` to begin."

#### C-3.3: sgc work
- `sgc work`:
  1. Read `current-task.md`, `feature-list.md`
  2. For each pending feature: print and prompt user/Claude to implement
  3. After each feature: ask user to confirm done; mark `[x]` in feature-list
  4. When all done: print "Run `sgc review` for independent review"
- No LLM call; this is a tracker, not an implementer. Real implementation done by Claude main session.

#### C-3.4: sgc review
- `sgc review`:
  1. Read `current-task.md` for active task_id
  2. `git diff` → capture
  3. Spawn `reviewer.correctness` (stub) with diff + intent → wait for `verdict + findings`
  4. Validate scope: reviewer MUST NOT have `read:solutions` (assert via capabilities.ts)
  5. Write `.sgc/reviews/{task_id}/code/correctness.md` (append-only)
  6. Print verdict summary

### Step 4 — Demo + tests (2 commits)

#### C-4.1: Demo run
- Run end-to-end: `sgc plan "add example section to plan/SKILL.md"` → `sgc work` → make change → `sgc review`
- Capture state file outputs in `docs/c-phase-demo.md` (just the file dumps + commands run).
- Verify all 7 invariants enforced (or document which are deferred).

#### C-4.2: Unit tests
- `tests/dispatcher/preprocessor.test.ts` — DSL transformations + idempotency
- `tests/dispatcher/state.test.ts` — schema validate, immutability, append-only
- `tests/dispatcher/capabilities.test.ts` — scope token computation, `forbidden_for` enforcement (Invariant §1)

### Step 5 — README + handoff (1 commit)

#### C-5.1: README + CLAUDE.md update
- `README.md` — what is sgc, install, commands, state layout, current implementation status (which commands work, which throw `NotImplementedYet`)
- Update `plugins/sgc/CLAUDE.md` — note that dispatcher is now executable for L0/L1 plan/work/review/status

## Total

~11 commits, ~5 days estimated.

## Out of Scope (D-phase candidates)

- L2 cluster (planner.ceo + planner.eng + researcher.history)
- L3 (planner.adversarial + human-signature gate)
- Real subagent dispatch (replace file-protocol stubs with `Task(...)`)
- compound 4-agent cluster + dedup similarity
- janitor.compound auto-decide
- qa.browser ↔ browse integration
- ship flow (gate + canary)
- L3 conditional reviewers (security-specialist, migration, performance-specialist, infra)
- 11th converter platform
- Setup/install script for end-users

## Reference Files

- `contracts/sgc-state.schema.yaml` — what dispatcher reads/writes
- `contracts/sgc-capabilities.yaml` — what each command/subagent may do
- `contracts/sgc-invariants.md` — non-negotiable rules dispatcher enforces
- `plugins/sgc/CLAUDE.md` — system overview (user-facing)
