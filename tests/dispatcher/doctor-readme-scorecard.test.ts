// P1-4 regression: the README four-化 scorecard must match live `sgc metrics`.
//
// README claims the scorecard numbers "are produced by `sgc metrics` … they are
// not hand-maintained" and invites the reader to run the command. They WERE
// hand-copied, and drifted: README said 自动化 4/6 while the tool printed 5/9
// (metrics.ts grew the CE-arc stages in v1.29+). The one marketing claim a user
// can disprove in one command was false. Prose can't be trusted to track code —
// so gate it.

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { readmeScorecardDrift } from "../../src/commands/doctor"
import { computeMetricsLive } from "../../src/dispatcher/metrics"
import type { FourHuaMetrics } from "../../src/dispatcher/metrics"

const REPO = resolve(import.meta.dir, "..", "..")

const live: FourHuaMetrics = {
  standardization: { machine_enforced: 12, total: 13 },
  intelligence: { llm_invokable: 11, total_subagents: 23 },
  automation: { automated_steps: 5, total_steps: 9 },
  efficiency: { install_steps: 1, runtime_node: ">=18", bundle_bytes: 937547 },
}

const goodReadme =
  "**Four-化 scorecard** (run `sgc metrics` to reproduce): 规范化 12/13 · 智能化 11/23 LLM-invokable · 自动化 5/9 · 高效化 1 step·node≥18."

describe("readmeScorecardDrift (P1-4)", () => {
  test("an in-sync scorecard reports no drift", () => {
    expect(readmeScorecardDrift(goodReadme, live)).toEqual([])
  })

  test("catches the exact v1.31.8 drift (自动化 4/6 vs live 5/9)", () => {
    const stale = goodReadme.replace("自动化 5/9", "自动化 4/6")
    const drifts = readmeScorecardDrift(stale, live)
    expect(drifts.length).toBeGreaterThan(0)
    expect(drifts.join(" ")).toContain("自动化")
  })

  test("catches 规范化 drift", () => {
    const stale = goodReadme.replace("规范化 12/13", "规范化 13/13")
    expect(readmeScorecardDrift(stale, live).join(" ")).toContain("规范化")
  })

  test("catches 智能化 drift", () => {
    const stale = goodReadme.replace("智能化 11/23", "智能化 23/23")
    expect(readmeScorecardDrift(stale, live).join(" ")).toContain("智能化")
  })

  test("a missing scorecard line is itself a drift (can't silently pass)", () => {
    expect(readmeScorecardDrift("# sgc\n\nno scorecard here\n", live).length).toBeGreaterThan(0)
  })

  test("THE REAL README is in sync with THE REAL live metrics", () => {
    // The check that would have caught the shipped bug.
    const readme = readFileSync(resolve(REPO, "README.md"), "utf8")
    expect(readmeScorecardDrift(readme, computeMetricsLive(REPO))).toEqual([])
  })
})
