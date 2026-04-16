// Eval scenario: L1 copy change (text-only UI string).
//
// User story: "update the welcome message on the dashboard"
// Expected pipeline: classifier → planner.eng → work → review (clean text
//                    diff) → ship → janitor (default_conservative skip)
//
// Distinct from sibling scenarios:
//   - L0-typo: classifier returns L0 on "fix typo" keyword → no intent.md
//   - L1-bugfix: same shape but bug-fix narrative + crash repro
//   - L1-copy (this): generic update language, no L0/L2/L3 keyword hits,
//     falls through to L1 default; reviewer gets a pure text diff with no
//     TODO/FIXME markers; passes cleanly with severity=none.
//
// Exercises the L1-copy fast-path mentioned in the user spec §7 ("text-only
// UI changes validate via Read + confirm; no logic/layout change"). At sgc
// level this is just normal L1 dispatch — the lighter-evidence pattern
// belongs in the human reviewer, not in the dispatcher's spawn graph.
//
// Invariants exercised: §1 reviewer no-solutions · §2 intent immutable
// · §6 review append-only + janitor logged · §11 classifier rationale
// · §12 (this)

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { runPlan } from "../../src/commands/plan"
import { runReview } from "../../src/commands/review"
import { runShip } from "../../src/commands/ship"
import { runWork } from "../../src/commands/work"
import {
  listSolutions,
  readIntent,
  readJanitorDecision,
  readReview,
  readShip,
} from "../../src/dispatcher/state"
import {
  agentsInvoked,
  createEvalWorkspace,
  destroyEvalWorkspace,
  LONG_MOTIVATION_FIXTURE,
} from "./eval-helpers"

let tmp: string
beforeEach(() => {
  tmp = createEvalWorkspace("sgc-eval-L1c-")
})
afterEach(() => {
  destroyEvalWorkspace(tmp)
})

describe("L1 copy scenario (eval §12)", () => {
  test("end-to-end: plan(L1) → work --done → review (clean) → ship", async () => {
    // STEP 1: plan — generic update language → L1 default (not L0 typo, not L2 api)
    const plan = await runPlan(
      "update the welcome message on the dashboard for new users",
      { stateRoot: tmp, motivation: LONG_MOTIVATION_FIXTURE, log: () => {} },
    )
    expect(plan.level).toBe("L1")
    expect(existsSync(resolve(tmp, "decisions", plan.taskId, "intent.md"))).toBe(true)

    // L1 cluster: classifier + planner.eng only (no ceo, researcher, adversarial)
    const agents = agentsInvoked(tmp)
    expect(agents).toContain("classifier.level")
    expect(agents).toContain("planner.eng")
    expect(agents).not.toContain("planner.ceo")
    expect(agents).not.toContain("researcher.history")
    expect(agents).not.toContain("planner.adversarial")

    // §11: rationale present
    const intent = readIntent(plan.taskId, tmp)
    expect(intent.body ?? "").toMatch(/Classifier rationale/)
    // L1-copy distinction: rationale is the "default" branch, not L0 fast-path
    expect(intent.body ?? "").toMatch(/default classification/)

    // STEP 2: work
    await runWork({ stateRoot: tmp, done: "f1", log: () => {} })

    // STEP 3: review — pure text diff (markdown copy change), no TODO markers
    const textDiff =
      "diff --git a/dashboard.tsx b/dashboard.tsx\n" +
      "+++ b/dashboard.tsx\n" +
      "-      <h1>Welcome back!</h1>\n" +
      "+      <h1>Welcome to your dashboard</h1>\n" +
      "-      <p>Get started by exploring your projects.</p>\n" +
      "+      <p>Get started by creating your first project.</p>\n"
    const review = await runReview({
      stateRoot: tmp,
      diffOverride: textDiff,
      log: () => {},
    })
    // Clean text diff → reviewer.correctness passes with severity none
    expect(review.verdict).toBe("pass")
    const stored = readReview(plan.taskId, "code", "reviewer.correctness", tmp)
    expect(stored?.report.verdict).toBe("pass")
    expect(stored?.report.severity).toBe("none")
    expect(stored?.report.findings.length).toBe(0)

    // STEP 4: ship — L1 needs no qa evidence; janitor decides skip on
    // default_conservative (clean L1, no severity flag)
    const ship = await runShip({ stateRoot: tmp, log: () => {} })
    expect(ship.shipPath).not.toBeNull()
    const { ship: shipDoc } = readShip(plan.taskId, tmp)
    expect(shipDoc.outcome).toBe("success")
    expect(ship.janitorDecision?.decision).toBe("skip")
    expect(ship.janitorDecision?.reason_code).toBe("default_conservative")
    expect(ship.compoundAction).toBeUndefined()

    // No solution entry (clean L1 doesn't compound)
    expect(listSolutions(tmp).length).toBe(0)
    expect(readJanitorDecision(plan.taskId, tmp)).not.toBeNull()
  })

  test("text-only diff with no logic markers leaves reviewer findings empty", async () => {
    await runPlan(
      "update the privacy policy paragraph in the footer",
      { stateRoot: tmp, motivation: LONG_MOTIVATION_FIXTURE, log: () => {} },
    )
    await runWork({ stateRoot: tmp, done: "f1", log: () => {} })
    const r = await runReview({
      stateRoot: tmp,
      diffOverride:
        "+    We collect minimal data to improve your experience.\n" +
        "+    See our updated cookie settings for details.\n",
      log: () => {},
    })
    expect(r.verdict).toBe("pass")
  })
})
