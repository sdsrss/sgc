// M5 / option B — reviewer.security + reviewer.tests gain a real LLM path.
//
// The heuristic is NOT removed; it becomes the fallback, exactly as
// reviewer.correctness has worked since the 2026-04-16 remediation. The whole
// switch is spawn.ts's ladder: `prompt_path && API_KEY` → LLM, else inline stub.
//
// The load-bearing test here is "no key → behaviour unchanged". This ships in a
// released package; a user without an API key must get byte-identical behaviour
// to v1.34.0. Everything else in this batch is reversible; that promise is not.

import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { load as yamlLoad } from "js-yaml"
import { resolveMode } from "../../src/dispatcher/spawn"
import { computeIntelligence } from "../../src/dispatcher/metrics"

const ROOT = resolve(import.meta.dir, "../..")
const CAPS = resolve(ROOT, "contracts/sgc-capabilities.yaml")

/** The two ids option B promotes. Deliberately 2, not 8 — see the M5 spec. */
const PROMOTED = ["reviewer.security", "reviewer.tests"] as const
/** Still heuristic after M5. Pinned so promoting one silently fails the suite. */
const STILL_HEURISTIC = [
  "reviewer.performance",
  "reviewer.maintainability",
  "reviewer.migration",
  "reviewer.infra",
] as const

function manifestFor(id: string): Record<string, unknown> {
  const raw = readFileSync(CAPS, "utf8")
  // loadSpec resolves the `<<: *reviewer_base` merge the way prod does.
  const spec = yamlLoad(raw) as { subagents: Record<string, Record<string, unknown>> }
  const entry = spec.subagents[id]
  if (!entry) throw new Error(`no manifest entry for ${id}`)
  return entry
}

describe("M5 option B — promoted ids are wired to a real prompt", () => {
  for (const id of PROMOTED) {
    test(`${id} declares a prompt_path`, () => {
      const p = manifestFor(id)["prompt_path"]
      expect(typeof p).toBe("string")
      expect((p as string).length).toBeGreaterThan(0)
    })
    test(`${id}'s prompt file exists and carries the <input_yaml/> placeholder`, () => {
      const p = manifestFor(id)["prompt_path"] as string
      const file = resolve(ROOT, p)
      expect(existsSync(file)).toBe(true)
      // spawn.ts:580 throws without this placeholder — a prompt that cannot
      // receive its input is worse than no prompt, because the manifest claims
      // the LLM path works.
      expect(readFileSync(file, "utf8")).toContain("<input_yaml/>")
    })
  }

  test("option B promoted exactly 2 — the other specialists stay heuristic", () => {
    for (const id of STILL_HEURISTIC) {
      expect(manifestFor(id)["prompt_path"]).toBeNull()
    }
  })
})

describe("M5 option B — no API key means no behaviour change (released-artifact promise)", () => {
  const noKeys = { ANTHROPIC_API_KEY: undefined, OPENROUTER_API_KEY: undefined }
  const withEnv = <T>(patch: Record<string, string | undefined>, fn: () => T): T => {
    const saved: Record<string, string | undefined> = {}
    for (const k of Object.keys(patch)) {
      saved[k] = process.env[k]
      if (patch[k] === undefined) delete process.env[k]
      else process.env[k] = patch[k]
    }
    try {
      return fn()
    } finally {
      for (const k of Object.keys(patch)) {
        if (saved[k] === undefined) delete process.env[k]
        else process.env[k] = saved[k]
      }
    }
  }

  for (const id of PROMOTED) {
    test(`${id} with no key → inline stub (the heuristic still runs)`, () => {
      const m = manifestFor(id) as never
      const mode = withEnv({ ...noKeys, SGC_FORCE_INLINE: undefined, SGC_AGENT_MODE: undefined }, () =>
        resolveMode({ inlineStub: () => ({}) }, m),
      )
      expect(mode).toBe("inline")
    })
    test(`${id} with an API key → routes to the LLM`, () => {
      const m = manifestFor(id) as never
      const mode = withEnv(
        { ANTHROPIC_API_KEY: "sk-test-placeholder", SGC_FORCE_INLINE: undefined, SGC_AGENT_MODE: undefined },
        () => resolveMode({ inlineStub: () => ({}) }, m),
      )
      expect(mode).toBe("anthropic-sdk")
    })
  }

  test("an explicit inline mode override beats a present API key (the opt-out path)", () => {
    const m = manifestFor("reviewer.security") as never
    const mode = withEnv({ ANTHROPIC_API_KEY: "sk-test-placeholder" }, () =>
      resolveMode({ inlineStub: () => ({}), mode: "inline" }, m),
    )
    expect(mode).toBe("inline")
  })
})

describe("M5 option B — the 智能化 metric moves for the stated reason", () => {
  test("LLM-invokable count is 13/23", () => {
    const i = computeIntelligence(readFileSync(CAPS, "utf8"))
    expect(i.total_subagents).toBe(23)
    // 11 at v1.34.0 + security + tests. The metric counts prompt_path truthiness,
    // so this number moving IS the wiring being real, not a label change.
    expect(i.llm_invokable).toBe(13)
  })
})
