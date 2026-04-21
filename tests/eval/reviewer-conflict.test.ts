// Eval scenario: worst-of verdict aggregation across multiple reviewers.
//
// When multiple reviewers return mixed verdicts, the aggregate must be the
// worst across all verdicts. The ordering is: pass < concern < fail.
//
// This tests the `worstVerdict` function directly (unit test) and also
// verifies the aggregated verdict through `runReview` at L3 level where
// specialist reviewers run alongside the correctness reviewer.
//
// Invariants exercised: §1 (reviewer no-solutions — no false pass),
//                       §12 (this)

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { worstVerdict } from "../../src/commands/review"
import { runPlan } from "../../src/commands/plan"
import { runReview } from "../../src/commands/review"
import { runWork } from "../../src/commands/work"
import type { Verdict } from "../../src/dispatcher/types"
import {
  createEvalWorkspace,
  destroyEvalWorkspace,
  LONG_MOTIVATION_FIXTURE,
} from "./eval-helpers"

describe("worstVerdict unit tests", () => {
  test("single fail among passes → fail", () => {
    const verdicts: Verdict[] = ["pass", "pass", "pass", "fail"]
    expect(worstVerdict(verdicts)).toBe("fail")
  })

  test("concern among passes → concern", () => {
    const verdicts: Verdict[] = ["pass", "concern", "pass"]
    expect(worstVerdict(verdicts)).toBe("concern")
  })

  test("all pass → pass", () => {
    const verdicts: Verdict[] = ["pass", "pass"]
    expect(worstVerdict(verdicts)).toBe("pass")
  })

  test("all fail → fail", () => {
    const verdicts: Verdict[] = ["fail", "fail", "fail"]
    expect(worstVerdict(verdicts)).toBe("fail")
  })

  test("fail + concern → fail (fail is worse than concern)", () => {
    const verdicts: Verdict[] = ["concern", "fail"]
    expect(worstVerdict(verdicts)).toBe("fail")
  })

  test("empty array → pass (base case)", () => {
    expect(worstVerdict([])).toBe("pass")
  })

  test("single pass → pass", () => {
    expect(worstVerdict(["pass"])).toBe("pass")
  })

  test("single concern → concern", () => {
    expect(worstVerdict(["concern"])).toBe("concern")
  })

  test("single fail → fail", () => {
    expect(worstVerdict(["fail"])).toBe("fail")
  })

  test("mixed ordering: concern, pass, fail, pass → fail", () => {
    const verdicts: Verdict[] = ["concern", "pass", "fail", "pass"]
    expect(worstVerdict(verdicts)).toBe("fail")
  })
})

describe("reviewer aggregation via runReview pipeline", () => {
  let tmp: string
  beforeEach(() => {
    tmp = createEvalWorkspace("sgc-eval-reviewer-conflict-")
  })
  afterEach(() => {
    destroyEvalWorkspace(tmp)
  })

  test("L3 review with specialist triggers → aggregate is worst-of all verdicts", async () => {
    const SIG = { signed_at: "2026-04-15T10:00:00Z", signer_id: "eval-user" }

    // L3 migration task triggers specialist reviewers when the diff
    // contains migration-related keywords
    const plan = await runPlan(
      "migration to add 2FA column to 10M-row users table",
      {
        stateRoot: tmp,
        motivation: LONG_MOTIVATION_FIXTURE,
        userSignature: SIG,
        readConfirmation: async () => "yes",
        log: () => {},
      },
    )
    expect(plan.level).toBe("L3")

    await runWork({ stateRoot: tmp, done: "f1", log: () => {} })

    // Diff with migration keyword to trigger specialist cluster
    const review = await runReview({
      stateRoot: tmp,
      diffOverride: "+  ALTER TABLE users ADD COLUMN totp_secret TEXT;\n",
      log: () => {},
    })

    // The aggregate verdict should be the worst of all reviewer verdicts.
    // At L3, specialist reviewers may run. The key property is: the
    // returned verdict equals worstVerdict([correctness, ...specialists]).
    // We verify this by checking the verdict matches the worst-of the
    // specialist reports + the main verdict.
    const allVerdicts: Verdict[] = [
      ...review.specialistReports.map((s) => s.verdict),
    ]
    // The aggregate already includes the correctness verdict; it should
    // be at least as bad as any individual specialist
    for (const sr of review.specialistReports) {
      if (sr.verdict === "fail") {
        expect(review.verdict).toBe("fail")
      }
    }
    // The aggregate should equal worstVerdict applied to all verdicts
    // (correctness + specialists)
    const recomputedWorst = worstVerdict([review.verdict, ...allVerdicts])
    expect(review.verdict).toBe(recomputedWorst)
  })

  test("L1 review returns single reviewer verdict (no specialists)", async () => {
    const plan = await runPlan(
      "fix the null pointer crash when the config file is missing on startup",
      { stateRoot: tmp, motivation: LONG_MOTIVATION_FIXTURE, log: () => {} },
    )
    expect(plan.level).toBe("L1")

    await runWork({ stateRoot: tmp, done: "f1", log: () => {} })

    const review = await runReview({
      stateRoot: tmp,
      diffOverride: "+  if (!fs.existsSync(configPath)) return DEFAULT_CONFIG\n",
      log: () => {},
    })

    // No specialists at L1 — aggregate equals the correctness verdict
    expect(review.specialistReports.length).toBe(0)
    expect(review.verdict).toBe("pass")
  })
})
