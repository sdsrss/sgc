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

## §4. L3 Forbids --auto

Any command invocation at task level L3 with `--auto` or equivalent automation flag is refused at the dispatcher level, with a non-overridable error. L3 tasks require a human signature in `intent.md` and a human confirmation at `/ship`. This is not a default, it is a hard rule.

The rationale is that L3 is the level at which irreversible architectural decisions live. Automation at L3 means a single miscalibrated classifier run can make an architectural change without human review. The cost of forcing a human in the loop at L3 is minutes per task; the cost of not forcing it is weeks of unwinding.

## §5. Reviewer Overrides Require Human Signature

When any reviewer returns `verdict == fail` and the ship gate proceeds anyway, the `override` field in the review report must be populated with `by`, `at`, and `reason`. The reason field has a minimum length of 40 characters to prevent "ok" style rubber-stamping. The dispatcher refuses to write a ship.md if a failing review lacks a corresponding populated override.

No subagent may populate the override field. Overrides are exclusively human.

## §6. Every Janitor Decision Is Logged

`janitor.compound` MUST write a decision report for every task it evaluates, including tasks it decides to skip. This is non-negotiable. The evaluation framework's regression diagnosis depends on being able to answer "why did this task not generate a solution entry?" — and the only correct answer is "because the janitor logged reason X on date Y".

Silent skips are forbidden. A janitor that cannot write its decision must abort the task and surface an error, not default to skip.

## §7. Schema Validation Precedes Every Write

The dispatcher validates every file write against `sgc-state.schema.yaml` before committing. A write that fails validation is rejected with the validation error surfaced to the calling subagent. Subagents may retry with corrected output; they may not disable validation.

There is no "validate later" or "lenient mode". If the schema rejects real-world outputs, the schema is wrong and must be fixed; weakening validation is forbidden.

## §8. Scope Tokens Are Computed At Spawn, Not Requested At Runtime

When a command invokes a subagent, the dispatcher computes the subagent's scope_token set from the permission matrix and the subagent manifest, and pins that set for the subagent's lifetime. The subagent cannot request additional capabilities during execution. Any file access, git operation, or spawn attempt outside the pinned set causes immediate termination.

The rationale is that runtime capability elevation is the standard exploit path for prompt injection in agentic systems. Pinning at spawn time and enforcing at the dispatcher closes that path. This is the subagent-layer instance of the scope binding mechanism from CLAUDE.md v3.8.

## §9. No Subagent Writes Outside Its Declared Outputs

A subagent manifest declares its `outputs` field. The dispatcher discards any produced content that does not match the declared output shape. A subagent cannot, for example, write a solution entry as a side effect of producing a review report — even if it holds both tokens by some accident of composition.

This prevents "helpful" subagents from corrupting state they were not invited to touch. The canonical failure case is a reviewer noticing a pattern and trying to append to `solutions/` "while it's here"; under §1 that is already impossible, but §9 generalizes the principle.

## §10. Failure of Any Compound Substep Aborts the Whole Compound

The compound cluster has five subagents. If any of them fails or times out, the entire compound operation is rolled back and no write to `solutions/` occurs. Partial compound writes are forbidden.

The rationale is that a half-written solution entry is worse than no entry. A solution without the `what_didnt_work` field, for instance, encourages the reader to re-walk dead-end paths. Better to log a janitor skip with reason `compound_cluster_failure` and surface the error for human diagnosis.

## §11. Classifier Must Justify

`classifier.level` must emit both a level and a rationale. The rationale must reference at least one concrete feature of the task (file count, risk keyword, blast radius, etc.) The dispatcher refuses classifications with empty or generic rationales.

This exists because without a justified classifier, L3 gets silently downgraded to L2 whenever the classifier is uncertain, and that erodes every downstream guarantee in this document.

## §12. The Evaluation Framework Is Authoritative

The ten-scenario evaluation framework is the conformance test for this entire specification. When the spec and the evaluation framework disagree, the evaluation framework wins and the spec is amended to match. This prevents spec drift from quietly invalidating the test suite.

When a new invariant is added to this document, a corresponding regression test is added to the evaluation framework in the same commit. No exceptions.

---

## Cross-References

- Invariant §1 is enforced by `sgc-capabilities.yaml` scope token `read:solutions` (forbidden_for list) and by the empty `solutions` row in the permission matrix for `/review` and `/qa`.
- Invariant §2 is enforced by the `editable_after_creation: false` field on `decisions.intent` and `decisions.ship` in `sgc-state.schema.yaml`.
- Invariant §3 is enforced by the `dedup` block in `solutions` section of `sgc-state.schema.yaml`, plus a dispatcher check.
- Invariant §4 is a dispatcher-level rule with no schema representation. It must be added to the command parser as the first-priority check.
- Invariant §5 is enforced by the conditional `override` field in `reviews.report`.
- Invariant §6 is enforced by the `janitor_decision` file being a required output of `janitor.compound` in the subagent manifest.
- Invariants §7, §8, §9 are dispatcher-level and have no schema representation.
- Invariant §10 is enforced by `compound.*` subagents running as a transaction; no partial commits.
- Invariant §11 is enforced by the required `rationale` field on `classifier.level` outputs.
- Invariant §12 is procedural and enforced by code review discipline.
