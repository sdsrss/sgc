---
status: implemented
revision: 2
task_id: 94913CB45F9D4C3E906B3C2C8E
feature_id: f2
parent_intent: .sgc/decisions/94913CB45F9D4C3E906B3C2C8E/intent.md
---

# CE-1 — prevention injection into planner.adversarial

## Goal

Close one feedback loop in sgc: prevention text accumulated in
`<stateRoot>/solutions/<category>/*.md` (via `compound.prevention`) is
keyword-matched against the current `intent_draft` and fed to
`planner.adversarial` as an input field, so the pre-mortem agent surfaces
recurring failure modes the codebase has already learned to avoid.

## Non-goals

- Do NOT inject preventions into `planner.eng` or `planner.ceo`. Their
  isolation from `solutions/` stays per current `prompts/planner-*.md`
  scope clauses.
- Do NOT change `planner.adversarial`'s declared `scope_tokens`. The
  data flows in as an input field pre-fetched by `/plan` (which already
  holds `read:solutions`); the agent capability fence stays intact.
- Do NOT introduce a new LLM-mode agent. Extraction is deterministic
  keyword overlap; no extra latency cost.
- Do NOT rewrite or extend the on-disk solution schema. Use the existing
  frontmatter `prevention:` field where present; skip files where it is
  absent or empty.
- Do NOT implement CE-2 (`sgc reflect`) or CE-3 (ship-failure compound
  trigger) in this task. They are separate features f3 / f4.

## Constraints

- **Reuse `walkSolutionsCorpus`** from
  `src/dispatcher/agents/researcher-history.ts` — single source of NFC +
  `Intl.Segmenter` tokenization truth. Export but do not move it.
- **No `read:solutions` added to `planner.adversarial` scope_tokens.**
  Data crosses the boundary as input, not as a runtime capability.
- **Prompt change is L3 by core §2** (shipped LLM-visible metadata),
  even though touched LOC is small. Treat as `feat:` for the
  CHANGELOG.
- **Invariant §1 narrative** (planner-adjacent isolation) is partially
  relaxed for `.adversarial`: re-document in the prompt itself with an
  explicit `Read: prior_preventions in input` clause replacing the old
  `Forbidden: read:solutions` line. `.eng` / `.ceo` clauses untouched.
- **Heuristic mode** (`plannerAdversarialHeuristic`) must continue to
  pass tests untouched — it ignores the new input field. LLM mode is
  the consumer.
- **Token budget**: each emitted prevention ≤ 240 chars after
  whitespace fold; emit at most 3 per spawn (cap on prompt growth).
- **Banned-vocab regex caveat** (mem #18): any added vocab list MUST
  preserve the v6.x distinction — `may break IF X` (concrete-conditional)
  is fine; bare `may break` is the banned form.

## Success criteria

1. New module `src/dispatcher/preventions.ts` exports
   `extractPreventions(intentDraft, stateRoot, opts?)` →
   `Promise<PriorPrevention[]>` where `PriorPrevention = { solution_ref,
   category, prevention_text }`, ≤3 entries, sorted by keyword-hit
   count, prevention_text whitespace-folded and ≤240 chars.
2. `plan.ts` extends the L3 `planner.adversarial` spawn call only:
   `prior_preventions` is appended to the input object when level === "L3"
   AND the array is non-empty. L1 / L2 paths unchanged.
3. `prompts/planner-adversarial.md` references a new `prior_preventions`
   field, instructs the LLM to mark recurrent failure shapes with
   `probability: high`, and removes the `Forbidden: read:solutions`
   bullet.
4. Type `PlannerAdversarialInput` gains optional `prior_preventions?:
   PriorPrevention[]`. Heuristic continues to ignore it.
5. Tests: extractor unit (5 cases — empty corpus, no keyword match,
   keyword match with prevention field, keyword match without
   prevention field, top-N truncation); plan.ts integration (L3 with
   seeded corpus produces non-empty `prior_preventions` in spawn
   input); LLM-mode eval CI-skip test verifies output preserves
   prior failure recognition. Test count delta: ≥7 new tests.
6. The lesson at `~/.claude/projects/-mnt-Sda2-dev-sdsbp-sgc/memory/feedback_sgc_plan_motivation_word_vendor.md`
   becomes the first seeded prevention entry under
   `.sgc/solutions/other/<slug>.md` and re-running `sgc plan` against a
   similar `vendor X` motivation does NOT spawn the 8 false-premise
   adversarial concerns it did the first time. End-to-end validation.
7. CHANGELOG.md gains a `## Unreleased` entry naming CE-1 by feature ID
   (f2 under intent 94913CB45F9D4C3E906B3C2C8E).

## Open questions

- Should the seed prevention (success criterion 6) be authored as a
  full `SolutionEntry` (all required fields) via a `sgc compound`
  invocation, or hand-authored with minimal frontmatter (legacy shape,
  works with the extractor's defensive read)? — resolve during T9.

## Change log

- 2026-05-21 r1 — initial draft from intent.md classifier + planner
  cluster outputs. Locks in: planner.adversarial-only injection,
  walkSolutionsCorpus reuse, no scope_tokens change, direct hand-edit
  entry.
- 2026-05-22 r2 — status → implemented. CE-1 shipped v1.4.0
  (`9e78c6a`); CE-1.1 hardening (RT-1/2/3/6/Perf-1 same-ship + RT-4
  prompt rewrite + RT-5 caps + L1 DRY/logger/size-cap + RT-7 LLM eval)
  shipped v1.4.1 (`8c2c278`) and `d8beb6c` (RT-7 eval, tests-only).
  All 6 success criteria met. Open question on seed-author shape
  resolved by hand-edit + defensive extractor read (no `sgc compound`
  bootstrap required for the seed). Deferred to future ships
  (tracked in v1.4.1 CHANGELOG Notes): prompt-injection delimiter,
  `solution_ref` `?` TS/YAML mismatch, 4 misc INFO, tracked-seed-
  corpus + first-run bootstrap UX (filed as a separate concern,
  not a CE-1 scope item).
