// Eval scenario: reviewer isolation (Invariant §1).
//
// §1 states: reviewer.* and qa.* agents MUST NOT read from solutions/.
// Enforced at three layers:
//   (a) manifest: sgc-capabilities.yaml lists them in forbidden_tokens_for
//   (b) computeSubagentTokens strips read:solutions from their pinned set
//   (c) spawn prompt carries explicit "FORBIDDEN from: read:solutions"
//
// This eval asserts the holistic property — through the live plan → review
// → qa pipeline, NONE of the written spawn prompts for reviewer.* or qa.*
// grant read:solutions, and all include the FORBIDDEN directive.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  computeCommandTokens,
  computeSubagentTokens,
} from "../../src/dispatcher/capabilities"
import { runPlan } from "../../src/commands/plan"
import { runQa } from "../../src/commands/qa"
import { runReview } from "../../src/commands/review"
import {
  createEvalWorkspace,
  destroyEvalWorkspace,
  LONG_MOTIVATION_FIXTURE,
} from "./eval-helpers"

const ISOLATED_AGENTS = [
  "reviewer.correctness",
  "reviewer.security",
  "reviewer.adversarial",
  "qa.browser",
] as const

let tmp: string
beforeEach(() => {
  tmp = createEvalWorkspace("sgc-eval-iso-")
})
afterEach(() => {
  destroyEvalWorkspace(tmp)
})

describe("reviewer isolation — manifest + capabilities (eval §12)", () => {
  test("computeSubagentTokens strips read:solutions for all isolated agents", () => {
    for (const agent of ISOLATED_AGENTS) {
      const tokens = computeSubagentTokens(agent)
      expect(tokens).not.toContain("read:solutions")
    }
  })

  test("/review and /qa command tokens do NOT grant read:solutions", () => {
    const review = computeCommandTokens("/review")
    expect(review).not.toContain("read:solutions")
    const qa = computeCommandTokens("/qa")
    expect(qa).not.toContain("read:solutions")
  })
})

describe("reviewer isolation — live spawn prompts (eval §12)", () => {
  test("review prompt: pinned tokens omit read:solutions + FORBIDDEN line present", async () => {
    await runPlan("add a new field to the public API response payload", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION_FIXTURE,
      log: () => {},
    })
    await runReview({ stateRoot: tmp, diffOverride: "+ok\n", log: () => {} })

    const promptDir = resolve(tmp, "progress/agent-prompts")
    const files = readdirSync(promptDir)
    const reviewPrompt = files.find((f) => f.includes("reviewer.correctness"))
    expect(reviewPrompt).toBeDefined()
    const text = readFileSync(resolve(promptDir, reviewPrompt!), "utf8")
    const pinned = text.match(/scope_tokens:\n((?:  - .+\n)+)/)?.[1] ?? ""
    expect(pinned).not.toContain("read:solutions")
    expect(text).toMatch(/FORBIDDEN from:.*read:solutions/)
  })

  test("qa.browser prompt: pinned tokens omit read:solutions + FORBIDDEN line present", async () => {
    await runPlan("add a new field to the public API response payload", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION_FIXTURE,
      log: () => {},
    })
    await runQa({
      stateRoot: tmp,
      target: "http://localhost:3000",
      flows: ["home"],
      log: () => {},
    })

    const promptDir = resolve(tmp, "progress/agent-prompts")
    const files = readdirSync(promptDir)
    const qaPrompt = files.find((f) => f.includes("qa.browser"))
    expect(qaPrompt).toBeDefined()
    const text = readFileSync(resolve(promptDir, qaPrompt!), "utf8")
    const pinned = text.match(/scope_tokens:\n((?:  - .+\n)+)/)?.[1] ?? ""
    expect(pinned).not.toContain("read:solutions")
    expect(text).toMatch(/FORBIDDEN from:.*read:solutions/)
  })

  test("researcher.history IS allowed read:solutions (control: §1 is targeted)", () => {
    // Negative control: §1 bans reviewer.*/qa.* but explicitly permits
    // researcher.history to mine solutions/ for prior art.
    const researcher = computeSubagentTokens("researcher.history")
    expect(researcher).toContain("read:solutions")
  })
})
