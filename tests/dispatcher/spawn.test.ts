import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  OutputShapeMismatch,
  PRIOR_ART_SENTINEL_BEGIN,
  PRIOR_ART_SENTINEL_END,
  SpawnError,
  SpawnTimeout,
  checkInvariantOneBackChannel,
  spawn,
} from "../../src/dispatcher/spawn"
import type { EventRecord, Logger } from "../../src/dispatcher/logger"
import {
  ensureSgcStructure,
  parseFrontmatter,
  serializeFrontmatter,
} from "../../src/dispatcher/state"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-spawn-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe("spawn — inline-stub mode", () => {
  test("classifier.level: writes prompt, executes stub, persists result", async () => {
    const r = await spawn("classifier.level", { user_request: "fix typo" }, {
      stateRoot: tmp,
      ulid: "01TESTULID0000000000000000",
      inlineStub: () => ({
        level: "L0",
        rationale: "test stub",
        affected_readers_candidates: ["alice"],
      }),
    })
    expect(r.spawnId).toBe("01TESTULID0000000000000000-classifier.level")
    expect(r.output).toEqual({
      level: "L0",
      rationale: "test stub",
      affected_readers_candidates: ["alice"],
    })
    expect(existsSync(r.promptPath)).toBe(true)
    expect(existsSync(r.resultPath)).toBe(true)
    const promptText = readFileSync(r.promptPath, "utf8")
    // classifier.level uses prompt_path → prompt file is the external
    // template with <input_yaml/> substituted. Expect template markers +
    // the substituted input YAML.
    expect(promptText).toContain("# Purpose")
    expect(promptText).toContain("## Input")
    expect(promptText).toContain("user_request: fix typo")
    expect(promptText).toContain("read:progress")  // template lists it under "Token scope:"
  })

  test("OutputShapeMismatch when stub returns wrong shape (missing field)", async () => {
    await expect(
      spawn("classifier.level", {}, {
        stateRoot: tmp,
        inlineStub: () => ({ level: "L0" }),  // missing rationale + affected_readers_candidates
      }),
    ).rejects.toThrow(OutputShapeMismatch)
  })

  test("OutputShapeMismatch on undeclared field (audit C1 fix)", async () => {
    await expect(
      spawn("classifier.level", {}, {
        stateRoot: tmp,
        inlineStub: () => ({
          level: "L0",
          rationale: "ok",
          affected_readers_candidates: ["alice"],
          surprise: "I am a sneaky extra field",
        }),
      }),
    ).rejects.toThrow(/undeclared output fields/)
  })

  test("OutputShapeMismatch when enum value is invalid (audit C1 fix)", async () => {
    await expect(
      spawn("classifier.level", {}, {
        stateRoot: tmp,
        inlineStub: () => ({
          level: "L99",  // not in enum[L0, L1, L2, L3]
          rationale: "ok",
          affected_readers_candidates: ["alice"],
        }),
      }),
    ).rejects.toThrow(/expected one of/)
  })

  test("OutputShapeMismatch when array field is not an array (audit C1 fix)", async () => {
    await expect(
      spawn("classifier.level", {}, {
        stateRoot: tmp,
        inlineStub: () => ({
          level: "L0",
          rationale: "ok",
          affected_readers_candidates: "not an array",
        }),
      }),
    ).rejects.toThrow(/expected array/)
  })

  test("forceError fault injection throws after prompt written, before result", async () => {
    // §10 transaction test harness: ensures the prompt audit file is
    // on disk (the spawn REQUEST was made) but no result file exists
    // (the spawn did NOT complete). runCompound relies on this property
    // to roll back — if a mid-cluster agent throws, writeSolution is
    // never called and solutions/ is untouched.
    const err = new Error("injected failure for §10 test")
    await expect(
      spawn("classifier.level", { user_request: "x" }, {
        stateRoot: tmp,
        ulid: "01FAULT0000000000000000000",
        forceError: err,
        inlineStub: () => ({ level: "L0", rationale: "x", affected_readers_candidates: [] }),
      }),
    ).rejects.toBe(err)
    // Prompt file WAS written (we saw the spawn request in the audit)
    const { existsSync } = require("node:fs")
    const pp = resolve(tmp, "progress/agent-prompts", "01FAULT0000000000000000000-classifier.level.md")
    const rp = resolve(tmp, "progress/agent-results", "01FAULT0000000000000000000-classifier.level.md")
    expect(existsSync(pp)).toBe(true)
    expect(existsSync(rp)).toBe(false)
  })

  test("valid stub output passes all type checks", async () => {
    const r = await spawn("reviewer.correctness", {}, {
      stateRoot: tmp,
      inlineStub: () => ({
        verdict: "pass",
        severity: "none",
        findings: [],
      }),
    })
    expect((r.output as { verdict: string }).verdict).toBe("pass")
  })

  test("Invariant §1: reviewer prompt pins no read:solutions + lists it as forbidden", async () => {
    // Use reviewer.security (synthesized prompt) to test that the FORBIDDEN
    // directive appears. reviewer.correctness now uses prompt_path (external
    // template) — its isolation is covered by computeSubagentTokens tests +
    // the eval/reviewer-isolation.test.ts manifest-layer checks.
    const r = await spawn("reviewer.security", {}, {
      stateRoot: tmp,
      inlineStub: () => ({
        verdict: "pass",
        severity: "none",
        findings: [],
      }),
    })
    const prompt = readFileSync(r.promptPath, "utf8")
    // Pinned tokens block (under `scope_tokens:` key) must NOT have read:solutions
    const pinnedBlock = prompt.match(/scope_tokens:\n((?:  - .+\n)+)/)?.[1] ?? ""
    expect(pinnedBlock).not.toContain("read:solutions")
    expect(pinnedBlock).toContain("write:reviews")
    // Forbidden list must INCLUDE read:solutions (new in D-1.1)
    expect(prompt).toContain("forbidden_tokens")
    expect(prompt).toMatch(/FORBIDDEN from:.*read:solutions/)
  })
})

describe("spawn — file-poll mode (SGC_USE_FILE_AGENTS=1)", () => {
  test("polls until result file appears", async () => {
    process.env["SGC_USE_FILE_AGENTS"] = "1"
    try {
      ensureSgcStructure(tmp)
      const ulid = "01POLLULID0000000000000000"
      const spawnId = `${ulid}-classifier.level`
      const resultPath = resolve(tmp, "progress/agent-results", `${spawnId}.md`)

      // Start spawn (will poll); race against scheduled writeFile after 50ms.
      // ensureSgcStructure already made progress/ but not progress/agent-results/;
      // mkdir it first.
      setTimeout(() => {
        const { mkdirSync } = require("node:fs")
        const { dirname } = require("node:path")
        mkdirSync(dirname(resultPath), { recursive: true })
        writeFileSync(
          resultPath,
          serializeFrontmatter({
            level: "L1",
            rationale: "from external",
            affected_readers_candidates: ["bob"],
          }),
          "utf8",
        )
      }, 50)

      const r = await spawn("classifier.level", {}, {
        stateRoot: tmp,
        ulid,
        timeoutMs: 5000,
        pollIntervalMs: 25,
      })
      expect(r.output).toEqual({
        level: "L1",
        rationale: "from external",
        affected_readers_candidates: ["bob"],
      })
    } finally {
      delete process.env["SGC_USE_FILE_AGENTS"]
    }
  })

  test("times out when no result appears", async () => {
    process.env["SGC_USE_FILE_AGENTS"] = "1"
    try {
      await expect(
        spawn("classifier.level", {}, {
          stateRoot: tmp,
          timeoutMs: 30_000, // MIN_TIMEOUT_MS — clamp floor
          pollIntervalMs: 30,
        }),
      ).rejects.toThrow(SpawnTimeout)
    } finally {
      delete process.env["SGC_USE_FILE_AGENTS"]
    }
  }, 40_000)

  // P3#10 — file-poll auto-deactivate inside Claude Code sessions
  test("P3#10 T11: file-poll + CLAUDE_PLUGIN_ROOT set → throws with Task() hint", async () => {
    process.env["SGC_USE_FILE_AGENTS"] = "1"
    process.env["CLAUDE_PLUGIN_ROOT"] = "/fake/plugin/root"
    try {
      await expect(
        spawn("classifier.level", {}, { stateRoot: tmp, ulid: "01CCSESSION00000000000000" }),
      ).rejects.toThrow(SpawnError)
      await expect(
        spawn("classifier.level", {}, { stateRoot: tmp, ulid: "01CCSESSION00000000000001" }),
      ).rejects.toThrow(/file-poll mode is disabled inside Claude Code/)
      await expect(
        spawn("classifier.level", {}, { stateRoot: tmp, ulid: "01CCSESSION00000000000002" }),
      ).rejects.toThrow(/Task\("classifier\.level"/)
    } finally {
      delete process.env["SGC_USE_FILE_AGENTS"]
      delete process.env["CLAUDE_PLUGIN_ROOT"]
    }
  })

  test("P3#10 T12: file-poll WITHOUT CLAUDE_PLUGIN_ROOT → polls as usual (existing behavior)", async () => {
    process.env["SGC_USE_FILE_AGENTS"] = "1"
    delete process.env["CLAUDE_PLUGIN_ROOT"]
    try {
      // Without an external writer, this would timeout — but we just verify
      // the request reaches polling (i.e. no P3#10 throw). Use a tiny timeout
      // so we get a SpawnTimeout, not a hang.
      await expect(
        spawn("classifier.level", {}, {
          stateRoot: tmp,
          timeoutMs: 30_000,
          pollIntervalMs: 30,
        }),
      ).rejects.toThrow(SpawnTimeout)  // poll-reached path, not P3#10 throw
    } finally {
      delete process.env["SGC_USE_FILE_AGENTS"]
    }
  }, 40_000)

  test("P3#10 T13: inline mode + CLAUDE_PLUGIN_ROOT set → no throw (gate scopes to file-poll only)", async () => {
    process.env["CLAUDE_PLUGIN_ROOT"] = "/fake/plugin/root"
    delete process.env["SGC_USE_FILE_AGENTS"]
    try {
      const r = await spawn("classifier.level", {}, {
        stateRoot: tmp,
        ulid: "01INLINECC0000000000000001",
        inlineStub: () => ({
          level: "L0",
          rationale: "inline ok",
          affected_readers_candidates: ["alice"],
        }),
      })
      expect(r.output).toMatchObject({ level: "L0" })
    } finally {
      delete process.env["CLAUDE_PLUGIN_ROOT"]
    }
  })

  test("P3#10 T14: §13 paired-event — no spawn.start / spawn.end emitted on file-poll Claude-Code gate", async () => {
    process.env["SGC_USE_FILE_AGENTS"] = "1"
    process.env["CLAUDE_PLUGIN_ROOT"] = "/fake/plugin/root"
    const events: EventRecord[] = []
    const captureLogger: Logger = {
      say: () => {},
      event: (partial) => {
        events.push({
          schema_version: 1,
          ts: new Date().toISOString(),
          ...partial,
        } as EventRecord)
      },
    }
    try {
      await expect(
        spawn("classifier.level", {}, {
          stateRoot: tmp,
          ulid: "01P3T14000000000000000000",
          logger: captureLogger,
          taskId: "t-p3-10",
        }),
      ).rejects.toThrow(SpawnError)
      expect(events.filter((e) => e.event_type === "spawn.start")).toHaveLength(0)
      expect(events.filter((e) => e.event_type === "spawn.end")).toHaveLength(0)
    } finally {
      delete process.env["SGC_USE_FILE_AGENTS"]
      delete process.env["CLAUDE_PLUGIN_ROOT"]
    }
  })
})

// ── P3#9 — Invariant §1 structural back-channel gate ───────────────────

describe("checkInvariantOneBackChannel — unit (P3#9)", () => {
  test("T1: reviewer.correctness with canonical heading in intent → throws SpawnError", () => {
    const input = {
      diff: "+ const x = 1",
      intent:
        "# Title\n\nSome motivation.\n\n## Prior art (researcher.history)\n\n- runtime/foo (score 0.9)",
    }
    expect(() =>
      checkInvariantOneBackChannel("reviewer.correctness", input),
    ).toThrow(SpawnError)
    expect(() =>
      checkInvariantOneBackChannel("reviewer.correctness", input),
    ).toThrow(/Invariant §1 violation/)
  })

  test("T2: only `intent` field is scanned — siblings like `diff` echoing the heading are OK", () => {
    // The diff field legitimately contains arbitrary code/text. A user's PR
    // could add a `## Prior art (researcher.history)` markdown heading to a
    // doc file, and that diff lands in reviewer input. The gate must not
    // false-positive on diff content — only the dispatcher-owned intent
    // field carries the back-channel signal.
    const inputDiffEcho = {
      diff: "+ ## Prior art (researcher.history)\n+ - new prior art entry",
      intent: "# Title\n\nMotivation paragraph, no Prior-art section.",
    }
    expect(() =>
      checkInvariantOneBackChannel("reviewer.correctness", inputDiffEcho),
    ).not.toThrow()
  })

  test("T3: qa.browser with canonical heading in intent → throws", () => {
    const input = {
      intent: "look at the page\n\n## Prior art (researcher.history)\n- ref",
      url: "https://example.com",
    }
    expect(() => checkInvariantOneBackChannel("qa.browser", input)).toThrow(
      SpawnError,
    )
  })

  test("T4: planner.eng with the heading → NO throw (planner allowed)", () => {
    // Planner cluster READS solutions for prior-art mining; §1 only forbids
    // reviewer.* / qa.* from seeing it.
    const input = {
      intent_draft:
        "# Title\n\n## Prior art (researcher.history)\n\n- runtime/foo",
    }
    expect(() =>
      checkInvariantOneBackChannel("planner.eng", input),
    ).not.toThrow()
  })

  test("T5: reviewer.correctness with CLEAN input → no throw", () => {
    const input = {
      diff: "+ const x = 1",
      intent: "# Title\n\nMotivation paragraph with no Prior art section.",
    }
    expect(() =>
      checkInvariantOneBackChannel("reviewer.correctness", input),
    ).not.toThrow()
  })

  test("T6: reviewer.tests, reviewer.maintainability, reviewer.adversarial, qa.* all gated", () => {
    const leaky = {
      intent: "x\n## Prior art (researcher.history)\n- ref",
    }
    for (const agent of [
      "reviewer.tests",
      "reviewer.maintainability",
      "reviewer.adversarial",
      "qa.browser",
    ]) {
      expect(() => checkInvariantOneBackChannel(agent, leaky)).toThrow(
        SpawnError,
      )
    }
  })

  test("T7: classifier.level, compound.*, researcher.history NOT gated", () => {
    // These agents legitimately handle solutions content; §1 doesn't apply.
    const leaky = {
      intent: "x\n## Prior art (researcher.history)\n- ref",
      intent_draft: "x\n## Prior art (researcher.history)\n- ref",
    }
    for (const agent of [
      "classifier.level",
      "compound.context",
      "compound.solution",
      "researcher.history",
    ]) {
      expect(() => checkInvariantOneBackChannel(agent, leaky)).not.toThrow()
    }
  })

  test("T8: generic '## Prior art' WITHOUT the researcher.history parenthetical → no throw", () => {
    // A user writing "## Prior art" in their own intent.body (e.g. citing
    // prior internal work themselves) is not a researcher.history back-
    // channel — the dispatcher only embeds the version with the
    // parenthetical. The narrower marker prevents false positives on
    // user-authored intent text.
    const userPriorArt = {
      intent:
        "# Title\n\n## Prior art\n\nUser-written citation of past internal work.",
    }
    expect(() =>
      checkInvariantOneBackChannel("reviewer.correctness", userPriorArt),
    ).not.toThrow()

    // And mid-line "## Prior art (researcher.history)" without a newline
    // anchor stays caught — the regex anchors on (^|\n) before the heading.
    const midline = {
      intent: "see ## Prior art (researcher.history) inline mention",
    }
    expect(() =>
      checkInvariantOneBackChannel("reviewer.correctness", midline),
    ).not.toThrow()
  })

  // ── P3 sentinel hardening ──────────────────────────────────────────────

  test("T8b: sentinel-begin marker (without legacy heading) → throws", () => {
    // The new producer wraps the prior-art block in HTML-comment sentinels.
    // The gate must detect the sentinel even if the heading is renamed,
    // translated, or stripped — that is the whole point of the hardening.
    const leaky = {
      intent:
        `# Title\n\n${PRIOR_ART_SENTINEL_BEGIN}\n` +
        `## 前期工作\n\n- runtime/foo (score 0.9)\n\n` +
        `${PRIOR_ART_SENTINEL_END}\n`,
    }
    expect(() =>
      checkInvariantOneBackChannel("reviewer.correctness", leaky),
    ).toThrow(SpawnError)
    expect(() =>
      checkInvariantOneBackChannel("reviewer.correctness", leaky),
    ).toThrow(/Invariant §1 violation/)
  })

  test("T8c: malformed sentinel (begin only, no end) still trips gate", () => {
    // A producer regression that emits begin without end is still a leak.
    // The gate matches the begin marker alone — fail-closed over fail-open.
    const partial = {
      intent: `${PRIOR_ART_SENTINEL_BEGIN}\n- runtime/foo`,
    }
    expect(() =>
      checkInvariantOneBackChannel("reviewer.correctness", partial),
    ).toThrow(SpawnError)
  })

  test("T8d: sentinel-end alone (no begin, no content) → no throw", () => {
    // An orphaned end marker carries no solutions content; legitimate diff/
    // doc that quotes the literal `<!-- sgc:prior-art:end -->` (e.g. in this
    // very test file's contributors-doc snapshot) should not false-positive.
    const tail = {
      intent: `# Title\n\nMotivation. ${PRIOR_ART_SENTINEL_END}\n`,
    }
    expect(() =>
      checkInvariantOneBackChannel("reviewer.correctness", tail),
    ).not.toThrow()
  })

  test("T8e: legacy heading still detected (defense-in-depth on Phase G/H intent.md)", () => {
    // Invariant §2 makes intent.md immutable. Phase G/H tasks wrote intent
    // files with the heading-only format; if any future reviewer flow reads
    // such a file, the gate MUST still trip. This branch is permanent, not
    // a transition shim.
    const legacyOnly = {
      intent:
        "# Title\n\n## Prior art (researcher.history)\n\n- runtime/foo (score 0.8)",
    }
    expect(() =>
      checkInvariantOneBackChannel("reviewer.correctness", legacyOnly),
    ).toThrow(SpawnError)
  })
})

describe("spawn — Invariant §1 gate integration (P3#9)", () => {
  test("T9: spawn() to reviewer.correctness with leaky input throws before spawn.start", async () => {
    const events: EventRecord[] = []
    const captureLogger: Logger = {
      say: () => {},
      event: (partial) => {
        events.push({
          schema_version: 1,
          ts: new Date().toISOString(),
          ...partial,
        } as EventRecord)
      },
    }
    await expect(
      spawn(
        "reviewer.correctness",
        {
          diff: "+ foo",
          intent: "title\n## Prior art (researcher.history)\n- runtime/x",
        },
        {
          stateRoot: tmp,
          logger: captureLogger,
          taskId: "t-gate",
          inlineStub: () => ({}),  // never reached
        },
      ),
    ).rejects.toThrow(/Invariant §1 violation/)
    // §13 Tier 1 contract: no spawn.start fired → no spawn.end owed
    expect(events.filter((e) => e.event_type === "spawn.start")).toHaveLength(0)
    expect(events.filter((e) => e.event_type === "spawn.end")).toHaveLength(0)
  })

  test("T10: spawn() to planner.eng with same leaky input succeeds (§1 doesn't apply)", async () => {
    const res = await spawn(
      "planner.eng",
      {
        intent_draft: "title\n## Prior art (researcher.history)\n- runtime/x",
      },
      {
        stateRoot: tmp,
        taskId: "t-allowed",
        inlineStub: () => ({
          verdict: "approve",
          concerns: [],
          structural_risks: [],
        }),
      },
    )
    expect(res.output).toMatchObject({ verdict: "approve" })
  })
})
