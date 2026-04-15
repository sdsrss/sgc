# D-Phase: Real Agents + L2/L3 + QA + Ship + Compound

Source of truth for D-phase. C-phase delivered the dispatcher skeleton with
heuristic stubs; D-phase replaces stubs with real Claude subagents and
implements the remaining 4 commands (`discover`, `qa`, `ship`, `compound`)
plus the L2/L3 planning clusters.

## Goal

Turn the MVP into a shippable tool by covering every invariant in runtime:

- **§3** (solutions dedup) — compound cluster + similarity scoring
- **§10** (compound transaction atomicity)
- **§11** (classifier rationale required) — tightening the existing validation
- **§12** (eval framework authoritative) — introducing the 10-scenario regression suite

…and by making the existing 8 invariants (enforced in C-phase) robust under
real LLM I/O rather than hardcoded stubs.

## Delivery vs plan (post-hoc)

Plan-step → actual commit mapping:

| Plan step | Plan deliverable | Actual delivery |
|-----------|-----------------|-----------------|
| D-1.1 | file-poll hardening + agent-loop | commit `cf50863` (as planned) |
| D-1.2 | §11 classifier rationale strict check | commit `4a643c5` (as planned) |
| D-1.3 | Anthropic SDK path | **commit `781ca65` — revised to claude CLI shell-out** per subscription-auth finding (Anthropic ToS prohibits SDK-with-subscription-OAuth). |
| D-1.4 | (unplanned) | **commit `514fd9a` — Anthropic SDK + auto-detect** added per user ask: "API key present → SDK; else subscription path". D-1.3 and D-1.4 together close the original D-1.3 intent. |
| D-2.1 | planner.ceo stub + L2 parallel | commit `1792711` (as planned) |
| D-2.2 | researcher.history + L2 3-way | commit `24bdd15` (as planned) |
| D-3.1 + D-3.2 | planner.adversarial + interactive gate | **commit `f1772fb` — combined** because the intent body building interleaved naturally across both |
| D-4.1 + D-4.2 | sgc qa + hasQaEvidence helper | **commit `75d8029` — combined** (tightly coupled) |
| D-5.1 | ship gate + writeShip | commit `896386f` (as planned) |
| D-5.2 | --pr + gh runner | commit `6c7303e` (as planned) |
| D-6.1 | solution state layer | commit `86beba7` (as planned) |
| D-6.2 | 4 compound agents + dedup + transaction | commit `d3e8f25` (as planned) — discovered + fixed `validateOutputShape` bug where manifests without declared outputs rejected all fields as "undeclared" |
| D-6.3 | janitor auto-trigger | commit `8b80733` (as planned) |
| D-7.1 | eval framework skeleton + 2 scenarios | commit `1574bbb` (as planned) |
| D-8.1 | docs + v1.1.0 | this commit |

Patterns vs C-phase:
- 2-step merges (D-3, D-4) where the halves were tightly coupled — same rationale as C-4.2 being inline with feature commits.
- Plan drift at D-1.3 (Anthropic SDK → claude CLI) driven by an external
  constraint (ToS) that only surfaced during research via
  claude-code-guide. D-1.4 was added live rather than retrofitted.
- `validateOutputShape` bug discovered only when D-6.2 stub outputs hit
  the path without declared manifest outputs — covered by a runtime
  test + fix in the same commit.

## Out of Scope (E-phase+)

- Multi-repo orchestration
- Long-lived server daemon
- Web UI
- Non-Claude model backends (OpenAI, local models, etc.)
- Plugin publishing / distribution
- IDE deep-integration beyond Claude Code

## Prerequisites (already done, C-phase)

- File-based spawn protocol (`src/dispatcher/spawn.ts`) with `SGC_USE_FILE_AGENTS=1` polling mode
- State layer with immutability + append-only enforcement
- 120 dispatcher unit tests
- 8 invariants enforced at runtime

## Decisions Locked from C-phase

Carrying forward for D-phase:

| # | Decision | Value |
|---|----------|-------|
| 8 | Manifest key format | short `reviewer.correctness`; dispatcher maps `sgc:X:Y` ↔ `X.Y` |
| 14 | Stub agent protocol | file-based prompt/result under `.sgc/progress/agent-{prompts,results}/` |
| — | Level upgrade-only | user cannot downgrade classifier verdict |

## Decisions Needed from You (6)

**D-dec-1. Real agent dispatch mechanism** (affects Step 1 foundation)

- (a) **File-poll to Claude main session** — existing `SGC_USE_FILE_AGENTS=1` path. User runs `sgc plan "..."` in one terminal; the CLI blocks waiting for a result file; user (or their Claude main session) reads prompt file, writes result file; CLI resumes. No API key needed.
- (b) **Direct Anthropic SDK calls** — CLI makes HTTP calls using `ANTHROPIC_API_KEY`. Faster UX (no manual copy/paste) but requires API key + cost.
- (c) **Both** — file-poll by default; `--api` flag opts into SDK.

**Recommendation: (a) first, then (c)** — file-poll already works, proves the protocol, ships fastest. SDK path is additive once proven.

**D-dec-2. Dedup algorithm for compound.related** (affects Step 6)

- (a) **Exact signature match only** — SHA-256 of `normalize(problem + error_fingerprint)`. Cheap, deterministic. Misses near-duplicates.
- (b) **Signature + simple text Jaccard** — fallback overlap-coefficient on tag-tokenized problem+symptoms. No embeddings; handles obvious restatements.
- (c) **Signature + cosine on embeddings** — real semantic dedup. Needs embedding API (Anthropic or local).

**Recommendation: (b)** — matches spec's "exact signature match (weight 1.0), fallback: cosine similarity over tag_vector + problem embedding" by substituting Jaccard for cosine. Swap to (c) later without breaking the interface. Keeps §3's 0.85 threshold meaningful.

**D-dec-3. qa.browser integration shape** (affects Step 4)

- (a) **Shell out to `plugins/sgc/browse/dist/browse`** binary — sgc qa spawns it with URL + flow JSON, parses stdout/result files.
- (b) **Direct import the browse TS source** (no binary rebuild needed on dev).
- (c) **Both**: binary in production, TS import in tests.

**Recommendation: (c)** — binary call for user-facing, TS import for tests (avoids chromium launch in CI).

**D-dec-4. ship flow scope** (affects Step 5)

- (a) **Minimum**: verify evidence (all reviews pass or have override) + create PR via `gh pr create`. No deploy, no canary.
- (b) **+ Land-and-deploy**: merge PR + wait for CI + deploy trigger.
- (c) **+ Canary**: (b) + post-deploy health monitoring via browse (reuses gstack `canary` skill).

**Recommendation: (a) for D-phase**, (b)/(c) as E-phase. ship-to-PR is the smallest unit that closes the loop; deploy is infrastructure-specific and better as a later, project-configurable layer.

**D-dec-5. classifier rationale strictness** (affects Step 1 — Invariant §11)

- (a) **Regex check**: rationale must contain at least one concrete reference (file name, keyword, line count) — bare "looks simple" rejected.
- (b) **Length gate only**: rationale must be ≥ 20 chars.
- (c) **No additional check**: trust the LLM.

**Recommendation: (a)** — matches invariant language ("rationale must reference at least one concrete feature of the task"); implementation = regex for `\.\w+|:\d+|L[0-3]|\d+\s*files?|\b(file|function|test|API|auth|schema)\b`. If rationale fails the check, refuse the classification (force re-run).

**D-dec-6. 10-scenario eval framework** (Invariant §12; affects Step 7)

- (a) **Build it this phase** — 10 end-to-end scenarios as `tests/eval/*.test.ts` (L0 typo, L1 bugfix, L2 cross-file, L3 migration + signature, qa browser, compound, dedup match/miss, reviewer isolation, cross-platform converter).
- (b) **Skeleton now**, body post-D — scaffold directory + 2 scenarios; 8 more as later commits.
- (c) **Defer to E-phase**.

**Recommendation: (b)** — having the skeleton means §12 ("eval framework is authoritative") is enforceable; filling all 10 during D-phase bloats the timeline.

## Step-by-Step

### Step 1 — Real Agent Foundation (3 commits)

#### D-1.1: Claude-main-session agent protocol
File-poll hardening: prompt file now includes structured "reply-to" instructions parseable by a Claude main session. Result file schema validated on arrival. Add `sgc agent-loop` helper command for the main session to run: reads unfulfilled prompt files, shows each to the user, writes the result.

New: `src/commands/agent-loop.ts`, `src/dispatcher/spawn-protocol.ts` (format helpers).
Updates: `src/dispatcher/spawn.ts` formatting.
Tests: `tests/dispatcher/agent-loop.test.ts`.

#### D-1.2: Invariant §11 (classifier rationale) strict check
Implement the regex-based rationale validator (per decision D-dec-5). Applied in `runPlan` after classifier returns; refuse + re-prompt if the rationale is generic.

Updates: `src/commands/plan.ts`, `src/dispatcher/agents/classifier-level.ts` (stub to emit better rationale).
Tests: +3 in `tests/dispatcher/sgc-plan.test.ts`.

#### D-1.3: `claude` CLI shell-out agent mode (revised)
Originally planned as Anthropic SDK direct path — revised after discovering
Anthropic's ToS (2026-02) prohibits subscription OAuth tokens with SDK.
For subscription users, the path is `claude -p` shell-out instead.

New: `src/dispatcher/claude-cli-agent.ts` — Bun.spawn to `claude -p`;
parses `{type: "result", result: "...yaml..."}` JSON; extracts YAML from
fenced/bare markdown; SubprocessRunner injectable for tests.
spawn.ts: new AgentMode "claude-cli"; resolveMode reads SGC_AGENT_MODE env.
Tests: 16 (extractYamlBody, success paths, error paths, spawn integration).

#### D-1.4: Anthropic SDK path + auto-detect (added)
Added per user request: "auto-detect ANTHROPIC_API_KEY; have key → SDK,
no key → subscription way". Subscription users automatically fall through
to claude-cli (priority 6) or file-poll (default).

New: `src/dispatcher/anthropic-sdk-agent.ts` — @anthropic-ai/sdk direct
call with adaptive thinking + ephemeral prompt caching + `claude-opus-4-6`.
Typed exception handling via `Anthropic.APIError`. Client factory
injectable for tests.
Dep added: `@anthropic-ai/sdk ^0.89.0`.
spawn.ts: new AgentMode "anthropic-sdk"; resolveMode priority chain
documented (opts.mode → env → inlineStub → API key → claude CLI → file-poll).
Tests: 17 (success + error paths, spawn integration, 8 priority cases).

### Step 2 — L2 Planner Cluster (2 commits)

#### D-2.1: planner.ceo stub + wire to L2 plan
Business-gate agent. Stub: heuristic approve + 1-2 generic concerns. Wired into `runPlan` when `level ∈ {L2, L3}`.

New: `src/dispatcher/agents/planner-ceo.ts`.
Updates: `src/commands/plan.ts` — parallel dispatch of `planner.ceo` + `planner.eng`.
Tests: +3 in `tests/dispatcher/sgc-plan.test.ts`.

#### D-2.2: researcher.history with solutions read + git log
Searches `.sgc/solutions/` for similar task signatures; `git log --oneline | grep <keywords>` for prior work. Returns prior-art refs for the intent body.

New: `src/dispatcher/agents/researcher-history.ts`.
Updates: `src/commands/plan.ts` — spawn for L2+.
Tests: +4 (empty solutions/, populated solutions/, git log hit/miss).

### Step 3 — L3 Adversarial (2 commits)

#### D-3.1: planner.adversarial stub
Pre-mortem agent: returns `failure_modes` array per manifest. Stub: pattern-matches known risk keywords (schema change, data migration, auth flow) → outputs likely failure scenarios.

New: `src/dispatcher/agents/planner-adversarial.ts`.
Updates: `src/commands/plan.ts` — spawn for L3 only.
Tests: +3.

#### D-3.2: L3 human-signature flow
User already passes `--signed-by`. Add interactive confirmation: after all L3 agents run, display plan summary and require explicit `yes` typed at stdin (not just the flag) before writeIntent. Bypass with `--auto` is **refused** at L3 (Invariant §4).

Updates: `src/commands/plan.ts`.
Tests: +2 (stdin simulated via pipe).

### Step 4 — sgc qa (2 commits)

#### D-4.1: browse binary bridge
Spawn `plugins/sgc/browse/dist/browse` as a child process with structured flow definition. Capture screenshots + console errors + page timings. qa.browser agent wraps the binary call per manifest contract.

New: `src/dispatcher/agents/qa-browser.ts`, `src/commands/qa.ts`.
Updates: `src/sgc.ts` (implement `qa` command).
Tests: +5 (mocked spawn; real chromium tests opt-in via env).

#### D-4.2: QA evidence → review integration
Write `reviews/{task_id}/qa/browser.md` with screenshot paths + failed flows. `/ship` checks this exists for L2+.

New: QA writer in `src/dispatcher/state.ts`.
Tests: +3.

### Step 5 — sgc ship (2 commits)

#### D-5.1: ship gate
Enforces: all review reports ≥ plan-level minimum pass; override.reason present where verdict=fail; qa evidence present for L2+; feature-list all-done.

New: `src/commands/ship.ts`, `src/dispatcher/ship-gate.ts`.
Updates: `src/sgc.ts`.
Tests: +6 (each gate failure + happy path).

#### D-5.2: writeShip + git integration
Immutable `decisions/{id}/ship.md`. Optionally `gh pr create` if `--pr` flag. Updates `progress/current-task.md` to mark task complete.

Updates: `src/commands/ship.ts`, `src/dispatcher/state.ts`.
Tests: +3.

### Step 6 — Compound Cluster (3 commits)

#### D-6.1: solution state layer
Add `writeSolution` / `readSolution` to `state.ts` with `solutions/{category}/{slug}.md` schema validation. Delete forbidden. Append-or-update-existing.

Updates: `src/dispatcher/state.ts`, `src/dispatcher/types.ts`.
Tests: +5.

#### D-6.2: compound cluster (4 agents + dedup)
`compound.{context,solution,related,prevention}` with file-poll stubs. `compound.related` implements dedup (decision D-dec-2). Cluster runs as atomic transaction (Invariant §10): if any agent throws, rollback all state writes.

New: 4 files under `src/dispatcher/agents/compound-*.ts`.
New: `src/dispatcher/dedup.ts` (Jaccard similarity).
New: `src/commands/compound.ts`.
Tests: +10.

#### D-6.3: janitor.compound auto-trigger after ship
After `sgc ship` success, `janitor.compound` runs per `decision_rules` in the manifest. Logs decision to `reviews/{task_id}/janitor/compound-decision.md` (Invariant §6 path locked in A-phase).

New: `src/dispatcher/agents/janitor-compound.ts`.
Updates: `src/commands/ship.ts` (post-ship hook).
Tests: +4 (each decision branch: compound/skip/update_existing/error).

### Step 7 — Eval Framework Skeleton + 2 Scenarios (1 commit)

Per D-dec-6 tier (b). Scaffold `tests/eval/` with:
- `L0-typo.eval.ts`
- `L1-bugfix.eval.ts`

Each scenario: sets up a fixture repo, runs `sgc plan → work → review → ship`, asserts invariants + final state. 8 more scenarios as backlog.

Tests: 2 new eval files.

### Step 8 — Docs + release prep (1 commit)

- README.md: update command status table (all 8 ✅ or note partial)
- `plugins/sgc/CLAUDE.md`: remove "D-phase" phrasing; describe production flow
- `docs/d-phase-demo.md`: capture L2 and L3 end-to-end demo runs
- Version bump `package.json` to 1.1.0

## Total

~16 commits, ~2 weeks estimated.

## Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|------------|
| R1 | File-poll protocol is awkward for user | High | Medium | D-dec-1 tier (c) adds SDK path for automation; file-poll remains for transparency |
| R2 | Real LLM output shapes drift from manifest | Medium | High | C-phase C1 fix (output shape check) already rejects unknown/mistyped fields; add retry w/ corrective prompt |
| R3 | Prompt injection via user task description | Medium | High | Invariant §8 (scope token pin at spawn) already closes spawn-time vector; §9 (output shape) closes result vector; add sanitization for CLI arg display |
| R4 | Dedup false positives silently merge unrelated solutions | Low | High | 0.85 threshold is spec-locked (Invariant §3); Jaccard more conservative than cosine for short texts; human review before final merge |
| R5 | qa.browser chromium launch fails on some platforms | Medium | Medium | Test environment documented (`--no-sandbox` or AppArmor config); skip flag for envs without chromium |
| R6 | Ship gate deadlocks on missing review | Low | Medium | Clear error message with `--override` flag (requires human signature) |
| R7 | Compound janitor writes corrupted solutions | Medium | Critical | Invariant §10 atomicity: all-or-nothing. Transaction implemented via write-to-tmp + atomic rename of the whole solution dir |
| R8 | Anthropic API outage blocks all commands | Low | Medium | File-poll fallback always available |

## Testing Strategy

- **Unit tests**: continue per-module (state, capabilities, spawn, each new agent).
- **Integration tests**: each command (plan/work/review/qa/ship/compound) gets one happy-path + at least 2 invariant-violation cases.
- **Eval scenarios**: skeleton + 2 scenarios (D-dec-6 tier b); remaining 8 scenarios as D-post backlog.
- **Coverage target**: new code ≥ 80% line coverage. Track via `bun test --coverage` (if supported) or manual review.
- **Regression**: all 120 C-phase tests must continue to pass. Tracked in CI (future E-phase: GitHub Actions).

## Reference Files

- `contracts/sgc-invariants.md` — §3/10/11/12 are the new-enforcement targets
- `contracts/sgc-capabilities.yaml` — manifests for all 19 agents; 11 are still stubbed
- `contracts/sgc-state.schema.yaml` — solutions + janitor_decision schemas for §3/§10
- `docs/c-phase-dispatcher.md` — C-phase plan (for contrast); "Delivery vs plan" section is the model for D-phase's post-hoc record
- `plugins/sgc/skills/*/SKILL.md` — skills still narrate processes inline; D-phase should collapse them to "route to `sgc <cmd>`"
