# SGC System Invariants
# Version: 0.1

These are the rules that cannot live in the state schema or the capabilities contract alone, because they are cross-cutting or require semantic judgment. Every invariant is numbered and referenced by the schema files and the evaluation framework. Violating any of these is a spec bug, not a runtime error.

## §1. Generator-Evaluator Separation

No subagent whose role is to evaluate work (`reviewer.*`, `qa.*`, `/review`, `/qa`) may hold `read:solutions`. This is enforced at two layers: the scope token vocabulary declares `read:solutions` as forbidden for those subagent patterns, and the permission matrix grants solutions as an empty array for `/review` and `/qa`.

The rationale is not technical, it is epistemic. A reviewer that can read prior solutions will exhibit confirmation bias toward historical judgments. Anthropic's harness paper showed that evaluators optimistically rate their own work; the same bias extends to evaluators who inherit institutional memory from a generator's notebook. The only way to keep `/review` honest is to keep it amnesiac.

Consequence: if a reviewer needs historical context to render a verdict, that is a design smell. Either the intent was underspecified (fix at `/plan`) or the reviewer's scope is wrong (fix the manifest). Do not patch by granting `read:solutions`.

## §2. Decisions Are Immutable

Once `decisions/{task_id}/intent.md` is written, no actor may modify it. This includes typo fixes and "clarifying" edits. If intent changes, the correct action is to create a new task with `parent_decision` pointing to the old one and mark the old one as superseded via the subsequent `ship.md`.

The rationale is that intent files are the audit surface for "why did we build this?" An editable intent is a rewriting of history, which destroys the ability to diagnose regressions in the evaluation framework. The cost of immutability is occasional clutter from superseded tasks; that cost is acceptable.

## §3. Solutions Writes Must Pass Dedup

No write to `solutions/` may occur without `compound.related` running first and returning a dedup result. The dispatcher enforces this by making `write:solutions` a capability that only activates after a dedup stamp is attached to the write request. A `write:solutions` without a dedup stamp is rejected at the dispatch layer.

This is the single most important defense against the failure mode where `solutions/` becomes a grep-hostile dump of near-duplicates. Once that failure mode takes hold, `planner.history` and `researcher.history` become noise amplifiers and the entire compound layer stops being an asset.

Similarity threshold is fixed at 0.85 and is not user-tunable. Making it tunable would mean users lower it the first time dedup inconveniences them. The evaluation framework includes a regression test for this.

### Metadata-only carve-out (CE-6, v1.10.0)

`applied_in: TaskId[]` on solution frontmatter — written by `src/dispatcher/applied-tracker.ts` `recordApplied` from `plan.ts` L3 wire-up — is an **explicit, named exemption** from the dedup write-gate. The rule that binds §3 is "solution-content changes (intent / prevention / what_didnt_work / source_task_ids / times_referenced) must route through `writeSolution()` with a `dedup_stamp` from `compound.related`". `applied_in` is audit-trail metadata, not part of the dedup signature, so mutating it does not destabilize the corpus the way duplicated solution content would. `recordApplied` therefore bypasses `writeSolution()` and goes directly through `parseFrontmatter` → spread-preserve-all-other-fields → `serializeFrontmatter` → `writeAtomic`. The regression test `tests/dispatcher/applied-tracker.test.ts` H8 ("Invariant §3 metadata-only carve-out (CRITICAL)") is the binding contract: it snapshots every solution-content field before `recordApplied` and asserts byte-for-byte equality after. If that test ever changes shape, the carve-out must be re-evaluated. Future metadata-only fields (anything that does not affect compound-related similarity scoring) may extend this carve-out by the same pattern; new fields that affect dedup MUST route through `writeSolution()`.

## §4. L3 Forbids --auto

Any command invocation at task level L3 with `--auto` or equivalent automation flag is refused at the dispatcher level, with a non-overridable error. L3 tasks require a human signature in `intent.md` and a human confirmation at `/ship`. This is not a default, it is a hard rule.

The rationale is that L3 is the level at which irreversible architectural decisions live. Automation at L3 means a single miscalibrated classifier run can make an architectural change without human review. The cost of forcing a human in the loop at L3 is minutes per task; the cost of not forcing it is weeks of unwinding.

## §5. Reviewer Overrides Require Human Signature

When any reviewer returns `verdict == fail` and the ship gate proceeds anyway, the `override` field in the review report must be populated with `by`, `at`, and `reason`. The reason field has a minimum length of 40 characters to prevent "ok" style rubber-stamping. The dispatcher refuses to write a ship.md if a failing review lacks a corresponding populated override.

No subagent may populate the override field. Overrides are exclusively human.

## §6. Audit-Trail Writes Are Durable (janitor decisions logged · review reports append-only)

Two faces of one principle: an audit-trail write must survive — never silently skipped, never silently overwritten. Both halves protect the same thing: the ability to later answer "what was decided, by whom, and when?"

**(a) Every janitor decision is logged.** `janitor.compound` MUST write a decision report for every task it evaluates, including tasks it decides to skip. This is non-negotiable. The evaluation framework's regression diagnosis depends on being able to answer "why did this task not generate a solution entry?" — and the only correct answer is "because the janitor logged reason X on date Y". Silent skips are forbidden: a janitor that cannot write its decision must abort the task and surface an error, not default to skip.

**(b) Review / QA / CSO reports are append-only.** Each `reviews/{task_id}/{stage}/{reviewer}.md` (and the analogous `cso/` report) is write-once per `(task, stage, reviewer)` triple — a second write for the same triple is rejected (`StateError("AppendOnly", …)` in `state.ts:appendReview`), never overwritten. A follow-up pass writes a new `<reviewer>.<suffix>.md` via the `--append-as` channel rather than mutating the prior report. Overwriting a verdict would destroy the audit surface the same way a silent janitor skip would.

## §7. Schema Validation Precedes Every Write

The dispatcher validates every file write against `sgc-state.schema.yaml` before committing. A write that fails validation is rejected with the validation error surfaced to the calling subagent. Subagents may retry with corrected output; they may not disable validation.

There is no "validate later" or "lenient mode". If the schema rejects real-world outputs, the schema is wrong and must be fixed; weakening validation is forbidden.

## §8. Scope Tokens Are Computed At Spawn, Not Requested At Runtime

When a command invokes a subagent, the dispatcher computes the subagent's scope_token set from the permission matrix and the subagent manifest, and pins that set for the subagent's lifetime. There is no channel by which a running subagent can request additional capabilities: the set is computed before `spawn.start` and never re-read.

The rationale is that runtime capability elevation is the standard exploit path for prompt injection in agentic systems. Pinning at spawn time removes the elevation channel.

**What "pinned" enforces, precisely.** Three distinct guarantees, none of which is syscall interception:

1. **Spawn-time rejection (machine-enforced).** A manifest that declares a token its permission-matrix row forbids never spawns — `capabilities.ts` throws `ScopeViolation` before any work begins. This is what makes §1's `reviewer/qa cannot read:solutions` real rather than aspirational.
2. **Input gating (machine-enforced).** The dispatcher controls what enters the subagent: the §1 back-channel gate rejects prior-art/pre-mortem content in the `intent` field before `spawn.start`, and the subagent receives only the input the dispatcher hands it.
3. **Output validation (machine-enforced).** §9 shape validation rejects undeclared output fields, and the §1 leak scan runs over every subagent's output in all modes.

**What it does NOT enforce, and why.** The pinned token set is delivered to LLM-backed subagents as prompt context — it is *advisory to the model*. sgc does not intercept an LLM subagent's file or git access, and **cannot**: in `claude-cli` mode the model's tool use executes inside a separate `claude -p` process, and in API modes it executes on the provider's side. Neither is inside sgc's process boundary. A prompt-injected LLM subagent that reads a file outside its pinned set is therefore caught — if at all — by the post-hoc output scan (verbatim leaks) rather than prevented at access time; a paraphrase can pass.

This is a deliberate boundary, not a deferred TODO. Treat §8 as **"pin + gate the I/O the dispatcher owns + scan what comes back"**, not as a sandbox. Deterministic subagents (inline stubs, `compound.related`) are the only ones whose access is bounded by construction — which is why the invariants that must not be LLM-bypassable (§3's dedup stamp, the §11 classifier floor) are anchored to deterministic code rather than to §8.

`assertScope` / `assertCanSpawn` / `tokensAllow` in `capabilities.ts` exist for dispatcher-mediated access paths and are exercised by `capabilities.test.ts`; they are not — and cannot be — an interception layer over out-of-process model tool use.

This is the subagent-layer instance of the scope binding mechanism from CLAUDE.md v3.8.

## §9. No Subagent Writes Outside Its Declared Outputs

A subagent manifest declares its `outputs` field. The dispatcher discards any produced content that does not match the declared output shape. A subagent cannot, for example, write a solution entry as a side effect of producing a review report — even if it holds both tokens by some accident of composition.

This prevents "helpful" subagents from corrupting state they were not invited to touch. The canonical failure case is a reviewer noticing a pattern and trying to append to `solutions/` "while it's here"; under §1 that is already impossible, but §9 generalizes the principle.

## §10. Failure of Any Compound Substep Aborts the Whole Compound

The compound cluster has four subagents (context, related, solution, prevention). `janitor.compound` is NOT one of them — it is the separate gate that decides *whether* to compound at all, and runs before the cluster. If any of them fails or times out, the entire compound operation is rolled back and no write to `solutions/` occurs. Partial compound writes are forbidden.

The rationale is that a half-written solution entry is worse than no entry. A solution without the `what_didnt_work` field, for instance, encourages the reader to re-walk dead-end paths. Better to log a janitor skip with reason `compound_cluster_failure` and surface the error for human diagnosis.

## §11. Classifier Must Justify

`classifier.level` must emit both a level and a rationale. The rationale must reference at least one concrete feature of the task (file count, risk keyword, blast radius, etc.) The dispatcher refuses classifications with empty or generic rationales.

This exists because without a justified classifier, L3 gets silently downgraded to L2 whenever the classifier is uncertain, and that erodes every downstream guarantee in this document.

## §12. The Evaluation Framework Is Authoritative

The ten-scenario evaluation framework is the conformance test for this entire specification. When the spec and the evaluation framework disagree, the evaluation framework wins and the spec is amended to match. This prevents spec drift from quietly invalidating the test suite.

When a new invariant is added to this document, a corresponding regression test is added to the evaluation framework in the same commit. No exceptions.

## §13. Spawn + LLM Event Audit Completeness (two-tier)

Every call to `spawn()` MUST emit a paired `spawn.start` and `spawn.end` event to `.sgc/progress/events.ndjson` (Tier 1, all modes). The `end` event's `payload.outcome` MUST be one of `success | timeout | error`.

Additionally, when the resolved mode is `anthropic-sdk` / `openrouter` / `claude-cli` (any LLM-backed mode), the agent MUST emit a paired `llm.request` and `llm.response` event (Tier 2). `llm.response.payload.outcome` MUST be one of `success | timeout | error | schema_violation`.

Emission is guaranteed by `try/finally` blocks:
1. `src/dispatcher/spawn.ts` — Tier 1 pair (all modes).
2. `src/dispatcher/anthropic-sdk-agent.ts` — Tier 2 pair.
3. `src/dispatcher/openrouter-agent.ts` — Tier 2 pair.
4. `src/dispatcher/claude-cli-agent.ts` — Tier 2 pair.

Other event types (`dedup.scored`, `review.verdict_emitted`, etc.) are voluntary during Phase G; their schemas evolve freely. Commands are expected (soft contract, smoke-tested) to emit at least one high-level event per primary flow.

**Exemption**: event-sink write failure (disk full, permission error) does NOT fail the spawn. The runtime logs the failure to stderr and continues. Invariant §13 is waived for infra-level write failures.

**Schema**: `EventRecord` v1 is defined in `src/dispatcher/logger.ts`. Every event line carries `schema_version: 1`; additive fields must preserve forward-compatibility, breaking changes bump to v2.

---

## Cross-References

- Invariant §1 is enforced by `sgc-capabilities.yaml` scope token `read:solutions` (forbidden_for list) and by the empty `solutions` row in the permission matrix for `/review` and `/qa`.
- Invariant §2 is enforced by the `editable_after_creation: false` field on `decisions.intent` and `decisions.ship` in `sgc-state.schema.yaml`.
- Invariant §3 is enforced by the `dedup` block in `solutions` section of `sgc-state.schema.yaml`, plus a dispatcher check.
- Invariant §4 is a dispatcher-level rule with no schema representation. It must be added to the command parser as the first-priority check.
- Invariant §5 is enforced by the conditional `override` field in `reviews.report`.
- Invariant §6 is enforced on two paths: (a) the `janitor_decision` file being a required output of `janitor.compound` in the subagent manifest, and (b) the write-once guard in `state.ts:appendReview` that rejects a second write to the same `(task, stage, reviewer)` triple with `StateError("AppendOnly", …)`.
- Invariants §7, §8, §9 are dispatcher-level and have no schema representation.
- Invariant §10 is enforced by `compound.*` subagents running as a transaction; no partial commits.
- Invariant §11 is enforced by the required `rationale` field on `classifier.level` outputs.
- Invariant §12 is procedural and enforced by code review discipline.
- Invariant §13 is enforced by `try/finally` in `src/dispatcher/spawn.ts` (Tier 1) and in each LLM-mode agent file (`anthropic-sdk-agent.ts`, `openrouter-agent.ts`, `claude-cli-agent.ts`) for Tier 2. Regression-tested by `tests/dispatcher/spawn-events.test.ts`, `tests/dispatcher/llm-agent-events.test.ts`, `tests/dispatcher/commands-event-emission.test.ts`, and `tests/eval/invariants.test.ts` (Task 12 scenario).
