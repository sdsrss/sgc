// planner.eng — unit tests for heuristic + LLM-routing readiness.
//
// Five assertion classes (per spec §5.1):
//   U1 — heuristic byte-compat under SGC_FORCE_INLINE
//   U2 — alias identity (plannerEng === plannerEngHeuristic)
//   U3 — manifest declares prompt_path
//   U4 — prompt template structure (## Input, <input_yaml/>, anti-patterns)
//   U5 — LLM-branch shape + schema-violation (mock anthropicClientFactory)

import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  plannerEng,
  plannerEngHeuristic,
  type PlannerEngOutput,
} from "../../src/dispatcher/agents/planner-eng"
import { getSubagentManifest } from "../../src/dispatcher/schema"
import { spawn, OutputShapeMismatch } from "../../src/dispatcher/spawn"

describe("planner.eng — unit", () => {
  test("U1a: heuristic returns approve + empty risks for short input", () => {
    const out = plannerEngHeuristic({ intent_draft: "fix bug" })
    expect(out.verdict).toBe("approve")
    expect(out.concerns).toEqual([
      "intent_draft is very short; consider clarifying motivation",
    ])
    expect(out.structural_risks).toEqual([])
  })

  test("U1b: heuristic returns approve + no concerns for long input", () => {
    const out = plannerEngHeuristic({
      intent_draft:
        "refactor the dispatcher's spawn function to add structured logging plus a retry-with-timeout outer loop, threading the logger through resolveMode and validating Invariant §13 Tier-2 emission",
    })
    expect(out.verdict).toBe("approve")
    expect(out.concerns).toEqual([])
    expect(out.structural_risks).toEqual([])
  })

  test("U2: plannerEng alias equals plannerEngHeuristic", () => {
    expect(plannerEng).toBe(plannerEngHeuristic)
  })

  test("U4: prompt template has required structural markers", () => {
    const tmplPath = resolve(process.cwd(), "prompts/planner-eng.md")
    const tmpl = readFileSync(tmplPath, "utf8")

    // spawn.ts:251 requires this regex — mirror it here exactly
    expect(tmpl).toMatch(/(^|\r?\n)##[ \t]+Input[ \t]*\r?\n/)
    expect(tmpl).toContain("<input_yaml/>")

    // spec §4 — anti-patterns section + first banned-vocab term
    expect(tmpl).toContain("## Anti-patterns")
    expect(tmpl).toContain("do NOT output")
    expect(tmpl).toContain("could potentially")

    // spec §4 — §13 boundary text (planner ≠ brainstorming)
    expect(tmpl).toMatch(/NOT.*brainstorming/i)

    // spec §4 — verdict enum referenced in reply format
    expect(tmpl).toContain("approve | revise | reject")
  })

  test("U3: manifest declares prompt_path for LLM routing", () => {
    const manifest = getSubagentManifest("planner.eng")
    expect(manifest).toBeDefined()
    expect(manifest!.prompt_path).toBe("prompts/planner-eng.md")
  })

  describe("U5: LLM-branch via mock anthropicClientFactory", () => {
    let tmp: string
    beforeEach(() => {
      tmp = mkdtempSync(join(tmpdir(), "sgc-planner-eng-u5-"))
    })
    afterEach(() => {
      rmSync(tmp, { recursive: true, force: true })
    })

    test("U5a: happy path — canned valid YAML parses to PlannerEngOutput", async () => {
      const cannedYaml = [
        "```yaml",
        "verdict: revise",
        "concerns:",
        "  - intent omits the rollback path for the migration",
        "structural_risks:",
        "  - area: migration runner",
        "    risk: forward-only schema change without explicit rollback step",
        "    mitigation: author a down-migration alongside the up-migration",
        "```",
      ].join("\n")
      const mockClient = {
        messages: {
          create: async () => ({
            id: "u5a",
            content: [{ type: "text", text: cannedYaml }],
            role: "assistant",
            model: "claude-sonnet-4-6-mock",
            stop_reason: "end_turn",
            stop_sequence: null,
            type: "message",
            usage: {
              input_tokens: 200,
              output_tokens: 80,
              cache_read_input_tokens: 0,
              cache_creation_input_tokens: 0,
            },
          }),
        },
      }
      const res = await spawn(
        "planner.eng",
        { intent_draft: "add an additive schema migration to the users table" },
        {
          stateRoot: tmp,
          taskId: "u5a",
          mode: "anthropic-sdk",
          anthropicClientFactory: () => mockClient as never,
        },
      )
      const out = res.output as PlannerEngOutput
      expect(out.verdict).toBe("revise")
      expect(out.concerns).toHaveLength(1)
      expect(out.structural_risks).toHaveLength(1)
      expect(out.structural_risks[0]!.area).toBe("migration runner")
      expect(typeof out.structural_risks[0]!.risk).toBe("string")
      expect(typeof out.structural_risks[0]!.mitigation).toBe("string")
    })

    test("U5b: schema violation — invalid verdict enum throws OutputShapeMismatch", async () => {
      const cannedYaml = [
        "```yaml",
        "verdict: invalid",
        "concerns: []",
        "structural_risks: []",
        "```",
      ].join("\n")
      const mockClient = {
        messages: {
          create: async () => ({
            id: "u5b",
            content: [{ type: "text", text: cannedYaml }],
            role: "assistant",
            model: "claude-sonnet-4-6-mock",
            stop_reason: "end_turn",
            stop_sequence: null,
            type: "message",
            usage: {
              input_tokens: 200,
              output_tokens: 20,
              cache_read_input_tokens: 0,
              cache_creation_input_tokens: 0,
            },
          }),
        },
      }
      await expect(
        spawn(
          "planner.eng",
          { intent_draft: "do anything" },
          {
            stateRoot: tmp,
            taskId: "u5b",
            mode: "anthropic-sdk",
            anthropicClientFactory: () => mockClient as never,
          },
        ),
      ).rejects.toBeInstanceOf(OutputShapeMismatch)
    })
  })
})
