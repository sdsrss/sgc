// planner.adversarial RT-4 recurrence-gate — real-LLM eval (CI-skip).
//
// CE-1.1 RT-7: verifies the RT-4 prompt rewrite (v1.4.1) actually holds
// under real LLM inference, not just regex on the prompt text. Runs only
// when ANTHROPIC_API_KEY or OPENROUTER_API_KEY is set; otherwise every
// test reports "skipped" so `bun test tests/eval` stays green in CI
// (publish.yml gates on tests/dispatcher only — these costs land on
// dogfood + local dev, not the publish path).
//
// What this tests
// ---------------
// The v1.4.0 ship taught `planner.adversarial` step 5 to "treat each
// entry [of prior_preventions] as a likely failure shape" and pinned
// `probability: high` for every emission. v1.4.1 RT-4 rewrote that
// section to require a *recurrence gate* (does intent_draft touch the
// same module/boundary/shape AND preserve the structural cause?), and
// added an explicit "Do NOT emit when the structural cause does not
// apply" branch.
//
// F2 is the critical fixture. It crafts an intent_draft with HIGH
// keyword overlap to the prior_prevention's text (the words
// "migration", "orders", "table" all appear) but ZERO structural cause
// overlap (the intent is docs-only — no schema mutation). Under the
// pre-RT-4 prompt, the LLM emitted a `data/migration-lock-*` failure
// mode by default. Post-RT-4, it must NOT emit it. If F2 flakes, RT-4
// did not actually narrow LLM behaviour and the prompt needs another
// rewrite pass.
//
// Seed fixtures live inline (no shared corpus on disk). The eval-helper
// `seedSolution` shape would also work, but the planner.adversarial
// path doesn't read solutions/ itself (it only consumes the
// pre-fetched `prior_preventions` input field) so we skip the
// filesystem detour entirely — the test passes input directly to
// spawn(), matching the production /plan flow.
//
// Cost: ≈ 4 calls × ~1500/300 in/out tokens × claude-sonnet ≈ ~5–10
// cents per full run.

import { describe, test, expect } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "../../src/dispatcher/spawn"
import type {
  PlannerAdversarialInput,
  PlannerAdversarialOutput,
} from "../../src/dispatcher/agents/planner-adversarial"
import type { PriorPrevention } from "../../src/dispatcher/preventions"

const HAS_KEY =
  !!process.env["ANTHROPIC_API_KEY"] || !!process.env["OPENROUTER_API_KEY"]

const MIGRATION_PREV: PriorPrevention = {
  solution_ref: "data/migration-lock-2026-04-12",
  category: "data",
  prevention_text:
    "ALTER TABLE on a 50M-row table acquires a long write lock that times out user-write requests at the API edge; use chunked backfill with a nullable column first and add NOT NULL only after backfill completes.",
}

const CACHE_PREV: PriorPrevention = {
  solution_ref: "perf/cache-stampede-2026-03-22",
  category: "perf",
  prevention_text:
    "Cache-fill thundering herd: on cache miss every request recomputed the tenant SHA; serialize the recompute behind a singleflight or use a stale-while-revalidate path.",
}

interface FixtureAsserts {
  /** A solution_ref that MUST appear in some failure_mode.early_signal. */
  mustEmitSolutionRef: string | null
  /** When mustEmitSolutionRef is set, the matching mode's probability must
   *  be one of these. RT-4 allows both high (direct) and medium (partial). */
  mustIncludeProbability: ReadonlyArray<"low" | "medium" | "high">
  /** solution_refs that MUST NOT appear in any failure_mode.early_signal —
   *  the RT-4 negative gate. F2 is the load-bearing case. */
  mustNotEmitSolutionRefs: ReadonlyArray<string>
}

interface Fixture {
  id: string
  intent_draft: string
  prior_preventions: ReadonlyArray<PriorPrevention> | undefined
  asserts: FixtureAsserts
}

const FIXTURES: ReadonlyArray<Fixture> = [
  {
    id: "F1-direct-recurrence",
    intent_draft:
      "Add a NOT NULL column `archived_at` (timestamptz) to the orders table on the prod database with a default backfill derived from the existing `status` column. The orders table has 50M+ rows.",
    prior_preventions: [MIGRATION_PREV],
    // Direct recurrence: same module (orders table), same shape
    // (ALTER + NOT NULL + backfill). Gate clears with no mitigating
    // factor mentioned in intent_draft. MUST emit a failure_mode that
    // references the solution_ref in early_signal.
    asserts: {
      mustEmitSolutionRef: "data/migration-lock-2026-04-12",
      mustIncludeProbability: ["high", "medium"],
      mustNotEmitSolutionRefs: [],
    },
  },
  {
    id: "F2-irrelevant-high-keyword-overlap",
    intent_draft:
      "Update the README and the docs/MIGRATION.md runbook to document the new schema-migration workflow used by the orders table team. Pure documentation change; no code, no SQL, no DDL touched.",
    prior_preventions: [MIGRATION_PREV],
    // RT-4 critical test: HIGH keyword overlap (migration / orders /
    // table all appear) but ZERO structural-cause overlap (intent is
    // docs-only — no schema mutation, no DDL, no DML). Under the
    // pre-RT-4 prompt the LLM would emit migration-lock by default.
    // Post-RT-4 it MUST NOT emit.
    asserts: {
      mustEmitSolutionRef: null,
      mustIncludeProbability: [],
      mustNotEmitSolutionRefs: ["data/migration-lock-2026-04-12"],
    },
  },
  {
    id: "F3-baseline-no-priors",
    intent_draft:
      "Add a NOT NULL column `archived_at` (timestamptz) to the orders table with a default backfill from the existing `status` column. The orders table has 50M+ rows.",
    prior_preventions: undefined,
    // Baseline: identical intent to F1 but no prior_preventions input
    // at all. Pre-mortem runs normally; no failure_mode should
    // reference any solution_ref since the input carried none.
    asserts: {
      mustEmitSolutionRef: null,
      mustIncludeProbability: [],
      mustNotEmitSolutionRefs: [
        "data/migration-lock-2026-04-12",
        "perf/cache-stampede-2026-03-22",
      ],
    },
  },
  {
    id: "F4-selective-mixed",
    intent_draft:
      "Add a NOT NULL column `archived_at` (timestamptz) to the orders table with a default backfill from the existing `status` column. The orders table has 50M+ rows.",
    prior_preventions: [MIGRATION_PREV, CACHE_PREV],
    // Mixed: migration-lock applies (schema mutation on prod table);
    // cache-stampede does NOT apply (this intent does not touch cache
    // paths). MUST emit migration-lock; MUST NOT emit cache-stampede.
    // Tests selective recurrence-gate evaluation across multiple priors.
    asserts: {
      mustEmitSolutionRef: "data/migration-lock-2026-04-12",
      mustIncludeProbability: ["high", "medium"],
      mustNotEmitSolutionRefs: ["perf/cache-stampede-2026-03-22"],
    },
  },
]

const EVAL_TIMEOUT_MS = 60_000

describe("planner.adversarial RT-4 recurrence-gate LLM eval (CE-1.1 RT-7)", () => {
  for (const f of FIXTURES) {
    test.skipIf(!HAS_KEY)(
      `${f.id} — ${f.intent_draft.slice(0, 50)}...`,
      async () => {
        const stateRoot = mkdtempSync(
          join(tmpdir(), `sgc-eval-adv-${f.id}-`),
        )
        try {
          const input: PlannerAdversarialInput = {
            intent_draft: f.intent_draft,
            ...(f.prior_preventions
              ? { prior_preventions: [...f.prior_preventions] }
              : {}),
          }
          const res = await spawn<unknown, PlannerAdversarialOutput>(
            "planner.adversarial",
            input,
            { stateRoot, taskId: f.id },
          )
          const out = res.output

          // Shape sanity. The prompt's reply contract demands a non-empty
          // failure_modes array with the four enum-valued fields each.
          expect(Array.isArray(out.failure_modes)).toBe(true)
          expect(out.failure_modes.length).toBeGreaterThan(0)
          for (const m of out.failure_modes) {
            expect(typeof m.scenario).toBe("string")
            expect(m.scenario.length).toBeGreaterThan(0)
            expect(["low", "medium", "high"]).toContain(m.probability)
            expect(["low", "medium", "high"]).toContain(m.impact)
            expect(typeof m.early_signal).toBe("string")
            expect(m.early_signal.length).toBeGreaterThan(0)
          }

          const earlySignals = out.failure_modes.map((m) => m.early_signal)

          // Positive gate: when a solution_ref must appear, it appears in
          // at least one early_signal, and the referencing mode's
          // probability is in the allowed set (RT-4 calibration —
          // high for direct, medium for partial).
          if (f.asserts.mustEmitSolutionRef) {
            const ref = f.asserts.mustEmitSolutionRef
            const refMode = out.failure_modes.find((m) =>
              m.early_signal.includes(ref),
            )
            if (!refMode) {
              throw new Error(
                `RT-4 positive gate violated: expected solution_ref "${ref}" to appear in some early_signal, but no failure_mode referenced it. ` +
                  `Fixture: ${f.id}. ` +
                  `Got ${out.failure_modes.length} mode(s); early_signals: ${JSON.stringify(earlySignals)}`,
              )
            }
            if (f.asserts.mustIncludeProbability.length > 0) {
              expect(
                f.asserts.mustIncludeProbability.includes(refMode.probability),
              ).toBe(true)
            }
          }

          // Negative gate (RT-4 core): listed solution_refs MUST NOT
          // appear in any early_signal. This is what fails when the
          // LLM ignores the recurrence gate under high keyword overlap.
          for (const ref of f.asserts.mustNotEmitSolutionRefs) {
            const offending = out.failure_modes.find((m) =>
              m.early_signal.includes(ref),
            )
            if (offending) {
              throw new Error(
                `RT-4 negative gate violated: solution_ref "${ref}" leaked into early_signal "${offending.early_signal}" with probability=${offending.probability}. ` +
                  `Fixture: ${f.id}. Intent: "${f.intent_draft.slice(0, 100)}...". ` +
                  `Pre-RT-4 the prompt told the LLM to always emit a recurrence for matching priors; if this fires post-RT-4 the rewrite did not narrow LLM behaviour and step 5 needs another pass.`,
              )
            }
          }
        } finally {
          rmSync(stateRoot, { recursive: true, force: true })
        }
      },
      EVAL_TIMEOUT_MS,
    )
  }
})
