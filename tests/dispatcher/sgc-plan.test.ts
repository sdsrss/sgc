import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { runPlan, degradedEngOutput, degradedCeoOutput } from "../../src/commands/plan"
import {
  readCurrentTask,
  readFeatureList,
  readIntent,
  ensureSgcStructure,
  writeSolution,
} from "../../src/dispatcher/state"
import type { Logger } from "../../src/dispatcher/logger"
import type { DedupStamp, SolutionEntry } from "../../src/dispatcher/types"
import { seedRelatedSpawn } from "../fixtures/related-spawn"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-plan-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

const LONG_MOTIVATION =
  "We need this change because the existing flow lacks a critical structural element that downstream readers depend on for clarity and discoverability of the underlying behavior contract."

describe("planner-cluster resilience — degraded output on spawn/parse failure", () => {
  function capturingLogger(): { logger: Logger; events: any[] } {
    const events: any[] = []
    const logger: Logger = { say: () => {}, event: (p) => events.push(p) }
    return { logger, events }
  }
  // Regression: in real OpenRouter mode a single planner emitting malformed YAML
  // ("bad indentation of a mapping entry") rejected Promise.all and aborted the
  // whole plan. eng/ceo now degrade gracefully (like researcher.history) so the
  // plan survives one planner's hiccup.
  test("degradedEngOutput → revise verdict + concern + warn event", () => {
    const { logger, events } = capturingLogger()
    const out = degradedEngOutput(new Error("YAMLException: bad indentation"), logger, "task-x")
    expect(out.verdict).toBe("revise")
    expect(out.concerns[0]).toMatch(/could not be evaluated/)
    expect(out.structural_risks).toEqual([])
    expect(events).toHaveLength(1)
    expect(events[0].event_type).toBe("planner.spawn_failed")
    expect(events[0].level).toBe("warn")
    expect(events[0].agent).toBe("planner.eng")
    expect(events[0].payload.error_class).toBe("Error")
  })
  test("degradedCeoOutput → revise verdict + concern + warn event", () => {
    const { logger, events } = capturingLogger()
    const out = degradedCeoOutput(new Error("boom"), logger, "task-y")
    expect(out.verdict).toBe("revise")
    expect(out.rewrite_hints).toEqual([])
    expect(events[0].agent).toBe("planner.ceo")
    expect(events[0].event_type).toBe("planner.spawn_failed")
  })
})

describe("prior-art render — no dangling ': ' on empty-body solution", () => {
  // Regression: compound writes frontmatter-only solutions (empty body), so the
  // heuristic excerpt is empty and the intent.md prior-art line rendered as
  // "**ref** (score 0.89): " with a dangling colon. Common case — most surfaced
  // prior art hit it.
  const STAMP: DedupStamp = {
    compound_related_spawn_id: "01STAMP-compound.related",
    threshold_met_or_forced: true,
    reason: "new_entry",
  }
  function emptyBodySolution(): SolutionEntry {
    return {
      id: "01PRIORARTSOLUTION0000000000",
      signature: "d".repeat(64),
      category: "auth",
      problem: "null pointer crash on login authentication flow when session expired",
      symptoms: ["crash on /login"],
      what_didnt_work: [],
      solution: "guard the null session before dereference",
      prevention: "assert session present before authenticate()",
      tags: ["authentication", "login", "null-pointer"],
      first_seen: "2026-04-15T10:00:00Z",
      last_updated: "2026-04-15T10:00:00Z",
      times_referenced: 0,
      source_task_ids: ["01ORIGINTASK0000000000000"],
    }
  }
  test("surfaced prior-art line ends at the score, not a trailing colon", async () => {
    ensureSgcStructure(tmp)
    // §3 (P2-6): the stamp's compound.related spawn must exist on disk.
    seedRelatedSpawn(tmp, STAMP.compound_related_spawn_id)
    // 4th arg "" → frontmatter-only solution (the empty-body case)
    writeSolution(emptyBodySolution(), "npe-login-auth", STAMP, "", tmp)
    const res = await runPlan(
      "guard null pointer on login authentication when session expired",
      {
        stateRoot: tmp,
        motivation:
          "returning users crash during login authentication because the expired session is dereferenced without a null guard so we add a defensive check additively",
        log: () => {},
      },
    )
    const intent = readFileSync(res.intentPath, "utf8")
    const priorLine = intent.split("\n").find((l) => l.includes("(score "))
    expect(priorLine).toBeDefined()
    expect(priorLine!.endsWith(": ")).toBe(false)
    expect(priorLine!).not.toMatch(/\):\s*$/)
  })
})

describe("runPlan — full L1 plan flow", () => {
  test("classifies as L1 (default), writes intent + feature-list + current-task", async () => {
    const log: string[] = []
    const r = await runPlan("add a markdown table to the README", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: (m) => log.push(m),
    })
    expect(r.level).toBe("L1")
    expect(r.taskId).toMatch(/^[0-9A-F]{26}$/)

    const intent = readIntent(r.taskId, tmp)
    expect(intent.title.length).toBeGreaterThan(0)
    expect(intent.affected_readers.length).toBeGreaterThan(0)
    expect(intent.scope_tokens).toContain("read:decisions:*")
    expect(intent.scope_tokens).toContain("write:decisions")

    const fl = readFeatureList(tmp)
    expect(fl?.list.features.length).toBe(1)

    const ct = readCurrentTask(tmp)
    expect(ct?.task.task_id).toBe(r.taskId)
    expect(ct?.task.level).toBe("L1")

    // audit trail: agent-prompts and agent-results files exist
    const promptDir = resolve(tmp, "progress/agent-prompts")
    expect(existsSync(promptDir)).toBe(true)
  })

  test("classifies typo task as L0 + skips intent.md (audit C3 adjacent fix)", async () => {
    const r = await runPlan("fix typo in README", { stateRoot: tmp, log: () => {} })
    expect(r.level).toBe("L0")
    expect(r.intentPath).toContain("skipped")
    expect(existsSync(resolve(tmp, "decisions", r.taskId, "intent.md"))).toBe(false)
  })

  test("classifies migration as L3 + refuses without signature", async () => {
    await expect(
      runPlan("add a database migration to rename column", {
        stateRoot: tmp,
        motivation: LONG_MOTIVATION,
        log: () => {},
      }),
    ).rejects.toThrow(/L3 plan requires human signature/)
  })

  test("L3 with --signed-by + 'yes' confirmation succeeds", async () => {
    const r = await runPlan("add a database migration to rename column", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      userSignature: { signed_at: "2026-04-15T10:00:00Z", signer_id: "alice" },
      readConfirmation: async () => "yes",
      log: () => {},
    })
    expect(r.level).toBe("L3")
    const intent = readIntent(r.taskId, tmp)
    expect(intent.user_signature?.signer_id).toBe("alice")
  })

  test("L3 without 'yes' confirmation throws + does NOT write intent (D-3.2)", async () => {
    await expect(
      runPlan("add a database migration to rename column", {
        stateRoot: tmp,
        motivation: LONG_MOTIVATION,
        userSignature: { signed_at: "2026-04-15T10:00:00Z", signer_id: "alice" },
        readConfirmation: async () => "no",
        log: () => {},
      }),
    ).rejects.toThrow(/not confirmed/)
  })

  test("L3 refuses --auto even with --signed-by (Invariant §4)", async () => {
    await expect(
      runPlan("add a database migration to rename column", {
        stateRoot: tmp,
        motivation: LONG_MOTIVATION,
        userSignature: { signed_at: "2026-04-15T10:00:00Z", signer_id: "alice" },
        autoConfirm: true,
        log: () => {},
      }),
    ).rejects.toThrow(/refuses --auto/)
  })

  test("classifies API change as L2", async () => {
    const r = await runPlan("add a new field to the public API response", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: () => {},
    })
    expect(r.level).toBe("L2")
  })

  test("forceLevel upgrade L1 → L2 succeeds", async () => {
    const r = await runPlan("simple change", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      forceLevel: "L2",
      log: () => {},
    })
    expect(r.level).toBe("L2")
  })

  test("forceLevel downgrade refused (upgrade-only per skill rule)", async () => {
    await expect(
      runPlan("add a database migration", {
        stateRoot: tmp,
        motivation: LONG_MOTIVATION,
        forceLevel: "L1",  // classifier returns L3, asking for L1 is downgrade
        log: () => {},
      }),
    ).rejects.toThrow(/upgrade-only/)
  })

  test("L1+ with short motivation throws (audit C3 fix)", async () => {
    await expect(
      runPlan("add a markdown table", {
        stateRoot: tmp,
        // No motivation; task description is 4 words
        log: () => {},
      }),
    ).rejects.toThrow(/≥20 words/)
  })

  test("short motivation fails fast — before the planner cluster runs", async () => {
    // Efficiency: the motivation word-count is known up front, so a too-short
    // motivation must be rejected after classification but BEFORE any planner
    // spawn (real LLM tokens in non-inline mode). Assert planner.eng never ran.
    const logs: string[] = []
    await expect(
      runPlan("add a markdown table", {
        stateRoot: tmp,
        log: (s) => logs.push(s),
      }),
    ).rejects.toThrow(/≥20 words/)
    expect(logs.some((l) => l.includes("classifier verdict"))).toBe(true)
    expect(logs.some((l) => l.includes("planner.eng"))).toBe(false)
  })

  // G.3 DF-1: pre-fix split(/\s+/) collapsed CJK runs to a single token
  // and rejected valid Chinese motivations. Post-fix uses Intl.Segmenter.
  test("L1+ with CJK motivation accepted via Intl.Segmenter word-count", async () => {
    const cjkMotivation =
      "事故复盘需要从结构化事件流里读到每次重试的尝试编号与耗时，否则需要逐个文件搜索 YAML 才能拼出失败链路；这条工作把 spawn.ts 的 retry-with-backoff 路径接进 logger。"
    // Sanity (verified manually 2026-04-27): same string under the old
    // split(/\s+/) counter returns 8 words (well under 20), under the new
    // Intl.Segmenter counter returns 45 word-like segments. The fix
    // crossing 20 is what unblocks the runPlan call below.
    const r = await runPlan("add CJK-aware logging to dispatcher spawn", {
      stateRoot: tmp,
      motivation: cjkMotivation,
      log: () => {},
    })
    expect(r.taskId).toBeTruthy()
    expect(r.intentPath).toMatch(/intent\.md$/)
  })

  test("intent.md is immutable: second runPlan with same id forbidden", async () => {
    // Different tasks get different IDs naturally; this proves writeIntent is
    // called with immutability and would catch collisions. We rely on the
    // state.test.ts coverage of IntentImmutable.
    const r1 = await runPlan("first task", { stateRoot: tmp, motivation: LONG_MOTIVATION, log: () => {} })
    const r2 = await runPlan("second task", { stateRoot: tmp, motivation: LONG_MOTIVATION, forceNewTask: true, log: () => {} })
    expect(r1.taskId).not.toBe(r2.taskId)
    expect(existsSync(resolve(tmp, "decisions", r1.taskId, "intent.md"))).toBe(true)
    expect(existsSync(resolve(tmp, "decisions", r2.taskId, "intent.md"))).toBe(true)
  })

  // GS-3: fused decision integration tests
  test("GS-3 Test A — L2 produces ## Fused decision before ## Planner.eng verdict", async () => {
    const r = await runPlan("add a new field to the public API response", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: () => {},
    })
    expect(r.level).toBe("L2")
    const intent = readIntent(r.taskId, tmp)
    expect(intent.fused_verdict).toBeDefined()
    expect(["approve", "revise", "reject"]).toContain(intent.fused_verdict!)
    expect(intent.body).toBeDefined()
    expect(intent.body!).toContain("## Fused decision")
    const fusedIdx = intent.body!.indexOf("## Fused decision")
    const engIdx = intent.body!.indexOf("## Planner.eng verdict")
    expect(fusedIdx).toBeGreaterThanOrEqual(0)
    expect(engIdx).toBeGreaterThan(fusedIdx)
  })

  test("GS-3 Test B — L1 has NO fused decision (regression lock)", async () => {
    const r = await runPlan("add a markdown table to the README", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: () => {},
    })
    expect(r.level).toBe("L1")
    const intent = readIntent(r.taskId, tmp)
    expect(intent.fused_verdict).toBeUndefined()
    expect(intent.body).not.toContain("## Fused decision")
  })
})
