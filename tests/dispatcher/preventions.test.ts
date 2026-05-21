// CE-1 (task 94913CB45F9D4C3E906B3C2C8E#f2) — extractPreventions tests.

import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  walkSolutionsCorpus,
  type SolutionScan,
} from "../../src/dispatcher/agents/researcher-history"
import {
  extractPreventions,
  type PriorPrevention,
} from "../../src/dispatcher/preventions"
import {
  plannerAdversarialHeuristic,
  type PlannerAdversarialInput,
} from "../../src/dispatcher/agents/planner-adversarial"

let stateRoot: string

beforeEach(() => {
  stateRoot = mkdtempSync(join(tmpdir(), "sgc-preventions-"))
  mkdirSync(join(stateRoot, "solutions"), { recursive: true })
})

afterEach(() => {
  rmSync(stateRoot, { recursive: true, force: true })
})

function seedSolution(
  category: string,
  slug: string,
  fm: Record<string, string>,
  body = "",
): void {
  mkdirSync(join(stateRoot, "solutions", category), { recursive: true })
  const fmYaml = Object.entries(fm)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n")
  writeFileSync(
    join(stateRoot, "solutions", category, `${slug}.md`),
    `---\n${fmYaml}\n---\n\n${body}\n`,
  )
}

describe("walkSolutionsCorpus export sanity (CE-1 T1)", () => {
  it("is a callable async function returning an array", async () => {
    const out: SolutionScan[] = await walkSolutionsCorpus(
      "/nonexistent-state-root-for-ce1",
      ["foo"],
    )
    expect(Array.isArray(out)).toBe(true)
    expect(out.length).toBe(0)
  })
})

describe("extractPreventions (CE-1 T2)", () => {
  it("E1 empty corpus returns []", async () => {
    const out: PriorPrevention[] = await extractPreventions(
      "any intent text here",
      stateRoot,
    )
    expect(out).toEqual([])
  })

  it("E2 no keyword match returns []", async () => {
    seedSolution(
      "runtime",
      "irrelevant-2026-05-21",
      {
        intent: "x",
        category: "runtime",
        prevention: "test the X boundary",
      },
      "body about completely unrelated topic",
    )
    const out = await extractPreventions("zzzzz qqqqq wwwww", stateRoot)
    expect(out).toEqual([])
  })

  it("E3 keyword match WITH prevention field returns one entry", async () => {
    seedSolution(
      "runtime",
      "back-channel-strip-2026-05-21",
      {
        intent: "x",
        category: "runtime",
        prevention: "strip prior-art section at consumer not producer",
      },
      "narrative body mentioning back-channel and reviewer leak",
    )
    const out = await extractPreventions(
      "how to handle the back-channel reviewer flow",
      stateRoot,
    )
    expect(out).toHaveLength(1)
    expect(out[0]!.solution_ref).toBe("runtime/back-channel-strip-2026-05-21")
    expect(out[0]!.category).toBe("runtime")
    expect(out[0]!.prevention_text).toBe(
      "strip prior-art section at consumer not producer",
    )
  })

  it("E4 keyword match WITHOUT prevention field is silently skipped", async () => {
    seedSolution(
      "runtime",
      "no-prevention-2026-05-21",
      { intent: "x", category: "runtime" },
      "body about back-channel reviewer leak with no prevention field",
    )
    const out = await extractPreventions("back-channel reviewer", stateRoot)
    expect(out).toEqual([])
  })

  it("E4b keyword match on file WITHOUT frontmatter fence is silently skipped", async () => {
    // Regression: planner-adversarial.test.ts seeds raw-markdown solution
    // fixtures with no `---` fence; preFilterSolutions tolerates them so
    // extractPreventions must too. Pre-fix: parseFrontmatter threw
    // NoFrontmatter and crashed the L3 plan flow.
    mkdirSync(join(stateRoot, "solutions", "_seed"), { recursive: true })
    writeFileSync(
      join(stateRoot, "solutions", "_seed", "raw-fixture.md"),
      "database migration rename column schema additive.",
    )
    const out = await extractPreventions(
      "database migration rename column",
      stateRoot,
    )
    expect(out).toEqual([])
  })

  it("E5 top-N truncation: 4 hits collapse to 3, sorted by hit count desc", async () => {
    seedSolution(
      "runtime",
      "a-2026-05-21",
      { intent: "x", category: "runtime", prevention: "p-a" },
      "alpha alpha alpha keyword",
    )
    seedSolution(
      "runtime",
      "b-2026-05-21",
      { intent: "x", category: "runtime", prevention: "p-b" },
      "alpha keyword foxtrot bravo charlie",
    )
    seedSolution(
      "runtime",
      "c-2026-05-21",
      { intent: "x", category: "runtime", prevention: "p-c" },
      "alpha alpha keyword foxtrot bravo",
    )
    seedSolution(
      "runtime",
      "d-2026-05-21",
      { intent: "x", category: "runtime", prevention: "p-d" },
      "alpha",
    )
    const out = await extractPreventions(
      "alpha keyword foxtrot bravo charlie",
      stateRoot,
    )
    expect(out).toHaveLength(3)
    // hits: b=5 (alpha/keyword/foxtrot/bravo/charlie), c=4 (alpha×2 once + keyword/foxtrot/bravo),
    // a=2 (alpha/keyword), d=1 (alpha). Top-3 sorted desc: b, c, a.
    // walkSolutionsCorpus counts UNIQUE keyword hits per file, not total occurrences.
    expect(out.map((p) => p.solution_ref)).toEqual([
      "runtime/b-2026-05-21",
      "runtime/c-2026-05-21",
      "runtime/a-2026-05-21",
    ])
  })

  it("E6 whitespace fold + 240-char ceiling on prevention_text", async () => {
    const longText = ("lock contention boundary check ".repeat(20)).replace(
      / /g,
      "\n  ",
    )
    seedSolution(
      "runtime",
      "long-2026-05-21",
      { intent: "x", category: "runtime", prevention: longText },
      "lock contention boundary alpha keyword",
    )
    const out = await extractPreventions(
      "lock contention boundary",
      stateRoot,
    )
    expect(out).toHaveLength(1)
    const text = out[0]!.prevention_text
    expect(text.includes("\n")).toBe(false)
    expect(text.length).toBeLessThanOrEqual(240)
  })
})

describe("planner-adversarial.md prompt template (CE-1 T4)", () => {
  const templatePath = "prompts/planner-adversarial.md"
  let templateText: string
  beforeEach(() => {
    const fs = require("node:fs") as typeof import("node:fs")
    templateText = fs.readFileSync(templatePath, "utf8")
  })

  it("mentions prior_preventions input channel", () => {
    expect(templateText.includes("prior_preventions")).toBe(true)
    expect(templateText.includes("Input channel: prior_preventions")).toBe(true)
  })

  it("dropped the legacy Forbidden: read:solutions bullet", () => {
    expect(templateText.includes("Forbidden: read:solutions")).toBe(false)
  })

  it("preserves the v6.x banned-vocab regex caveat for 'may break IF X'", () => {
    // Memory #18: do not over-fire on concrete-conditional usage.
    // The caveat itself does not need to appear in this prompt verbatim;
    // assert instead that the banned-vocab section (if present) does NOT
    // ban the bare phrase "may break", which would conflict with the v6.x
    // caveat. The adversarial prompt should permit "may break IF X" usage.
    const banLines = templateText.split("\n").filter((l) =>
      l.includes("`could potentially`") || l.includes("`might affect`"),
    )
    for (const line of banLines) {
      expect(line.includes("`may break`")).toBe(false)
    }
  })
})

describe("PlannerAdversarialInput.prior_preventions optional field (CE-1 T3)", () => {
  it("heuristic output is identical with and without prior_preventions", () => {
    const baseline = plannerAdversarialHeuristic({
      intent_draft: "migrate users table",
    })
    const withPrev: PlannerAdversarialInput = {
      intent_draft: "migrate users table",
      prior_preventions: [
        {
          solution_ref: "data/migration-lock-2026-05-21",
          category: "data",
          prevention_text: "use lock-free batched backfill",
        },
      ],
    }
    const result = plannerAdversarialHeuristic(withPrev)
    expect(result.failure_modes).toEqual(baseline.failure_modes)
  })
})
