// M4 (code-review follow-up to P3-2): the honesty pass shipped two FRESH
// overclaims, and check (N) waved both through.
//
// P3-2 rewrote 10 agent descriptions to match reality and added check (N) to
// keep them that way. Two of the rewrites were wrong:
//
//   - reviewer/maintainability.md advertised "size/shape signals (long
//     functions, large files)". reviewerMaintainability flags long *lines*
//     (>120 chars) and suppression markers. No function-length analysis, no
//     file-size analysis, anywhere. It invented two capabilities and omitted
//     the one real check a caller might act on.
//   - janitor/archive.md described "archival/retention housekeeping over .sgc/
//     state". `grep -rn archive src/ --include=*.ts` returns nothing. There is
//     no implementation at all.
//
// That is worse than the stale claims P3-2 removed: an inaccurate description
// that reads as freshly audited is trusted more, not less.
//
// (N) passed them because it tests for MAGIC WORDS, not accuracy — "heuristic"
// present, obligation satisfied. That is a real ceiling: a check cannot know
// whether prose matches an implementation. The tests below pin what a check
// CAN enforce (wiring, both directions, parse robustness) and pin the two
// descriptions against the code they describe.

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  agentMetadataDrift,
  readAgentMdFiles,
  type AgentMdFile,
  type ManifestLookup,
} from "../../src/commands/doctor"
import {
  PERFORMANCE,
  matchSpecialists,
  reviewerPerformance,
} from "../../src/dispatcher/agents/reviewer-specialists"
import { MAINT_MARKER_TERMS } from "../../src/dispatcher/agents/reviewer-quality"
import { buildPattern } from "../../src/dispatcher/agents/terms"
import { getCapabilities, getSubagentManifest } from "../../src/dispatcher/schema"

const ROOT = resolve(import.meta.dir, "../..")

const lookupReal: ManifestLookup = (id) => getSubagentManifest(id) ?? null
const allManifestIds = (): string[] => Object.keys(getCapabilities().subagents)

function descOf(file: string): string {
  const text = readFileSync(resolve(ROOT, file), "utf8")
  return /description:\s*"([^"]*)"/.exec(text)?.[1] ?? ""
}

// ─── E1/E2/E3: the descriptions must match the code ───────────────────────

describe("M4 · descriptions the honesty pass got wrong", () => {
  test("maintainability.md describes the checks reviewerMaintainability performs", () => {
    const d = descOf("plugins/sgc/agents/reviewer/maintainability.md")
    const impl = readFileSync(resolve(ROOT, "src/dispatcher/agents/reviewer-quality.ts"), "utf8")

    // Ground the assertions in the implementation rather than in my reading of
    // it: these two are what the code actually looks at.
    expect(impl).toContain("MAX_LINE = 120")
    // This asserted the marker set by regex-scraping this file's SOURCE TEXT for
    // `MAINT_MARKERS = /(TODO|FIXME`, until v1.36.0 made the pattern a
    // buildPattern() call (the same move Task 2 made for reviewer-specialists.ts).
    // Asserting behaviour against the exported term list survives that move —
    // the fact owed is "the marker matcher looks for TODO/FIXME and is
    // case-sensitive", and it is now assertable directly.
    expect(MAINT_MARKER_TERMS.map((t) => t.display)).toEqual(
      expect.arrayContaining(["TODO", "FIXME"]))
    expect(buildPattern(MAINT_MARKER_TERMS, "").test("TODO")).toBe(true)
    expect(buildPattern(MAINT_MARKER_TERMS, "").test("todo")).toBe(false)   // case-SENSITIVE
    expect(impl).not.toMatch(/function.*length|lines\s*per\s*function|file\s*size/i)

    // So the description must claim those, and must not claim the two things
    // it invented.
    expect(d).toMatch(/long added line|long line|120/i)
    expect(d).toMatch(/TODO|FIXME|marker|suppress/i)
    expect(d).not.toMatch(/long function/i)
    expect(d).not.toMatch(/large file/i)
  })

  test("performance.md does not present its spawn trigger as a finding", () => {
    // `perf` lives in the DIFF_CONDITIONAL_SPECIALISTS trigger, NOT in
    // PERFORMANCE.pattern — so a line containing only "perf" spawns the reviewer
    // and is then never flagged by it. Pin that asymmetry so the description
    // cannot re-conflate.
    //
    // This asserted the asymmetry by regex-scraping this file's SOURCE TEXT for
    // `pattern: /…/i,` until v1.36.0 made the pattern a buildPattern() call. That
    // scraper deserved to break: it read the source the way the descriptions it
    // polices read the source — as prose — and it fell back to `?? ""`, so its
    // `not.toContain("perf|")` half would have passed against an empty string no
    // matter what the code did. Asserting behaviour instead is both the fix and
    // the point of the exercise.
    const perfDiff = "--- a/x.ts\n+++ b/x.ts\n+  // perf work here\n"

    // Spawns on `perf`…
    expect(matchSpecialists(perfDiff).map((s) => s.name)).toContain("reviewer.performance")
    // …and then reports nothing about it. That is the asymmetry, end to end —
    // the old scraper only ever pinned the matcher half.
    expect(reviewerPerformance({ diff: perfDiff, intent: "" }).findings).toHaveLength(0)
    expect(PERFORMANCE.pattern.test("perf")).toBe(false)
    expect(PERFORMANCE.terms.some((t) => t.display === "perf")).toBe(false)

    // While a real term still is matched — otherwise the assertions above pass
    // against a matcher that matches nothing at all.
    expect(PERFORMANCE.pattern.test("cache")).toBe(true)
    expect(PERFORMANCE.terms.some((t) => t.display === "cache")).toBe(true)

    const d = descOf("plugins/sgc/agents/reviewer/performance.md")
    expect(d).not.toMatch(/mentioning perf\b|perf\/cache/i)
  })

  // M5 REVERSED THIS TEST'S FRAMING — kept, not deleted, because the fact it
  // guards is still owed; what changed is which fact leads.
  //
  // M4 required archive.md to LEAD with "NOT IMPLEMENTED". That is true of the
  // CLI and disastrous as a routing signal: this file's body is a live 86-line
  // prompt that MOVES `.sgc/` directories, and its only executor is the Claude
  // Code dispatch decision that reads this very field. The most destructive agent
  // in the set wore the most inert-sounding label — a human skims "NOT
  // IMPLEMENTED" and stops reading; a router drops the candidate on the leading
  // token. So M5 requires the danger first and the CLI absence second.
  test("janitor/archive.md leads with the destructive fact, and still discloses CLI absence", () => {
    const d = descOf("plugins/sgc/agents/janitor/archive.md")
    // Leads with what it does to your disk.
    expect(d.slice(0, 40)).toMatch(/moves files on disk/i)
    // Still discloses that no sgc command runs it — demoted, not dropped.
    expect(d).toMatch(/no archive command|manual-only|never runs/i)
    // Still names the rails, because an armed agent's description is where a
    // reader decides whether to arm it.
    expect(d).toMatch(/auth/i)
    expect(d).toMatch(/solutions/i)
    // The old overclaim P3-2 removed must not creep back.
    expect(d).not.toMatch(/housekeeping over|retention housekeeping/i)
  })
})

// ─── E6: what a wiring check CAN enforce ──────────────────────────────────

const okEntry = { prompt_path: null, status: "implemented" }

function file(id: string, desc: string): AgentMdFile {
  const [group, name] = id.split(".")
  return {
    id,
    file: `plugins/sgc/agents/${group}/${name}.md`,
    text: `---\nname: ${group}-${name}\ndescription: "${desc}"\n---\n\nbody\n`,
  }
}

describe("M4 · check (N) binds the registry in BOTH directions", () => {
  test("a manifested agent with no registry file is reported", () => {
    // Live consequence: reviewer.migration and reviewer.infra are manifested,
    // dispatched at L2+, and have no agents/*.md — the registry was already
    // missing two entries and (N) said nothing, because it only ever walked
    // files → manifest.
    const drifts = agentMetadataDrift(
      [file("reviewer.security", "heuristic keyword matcher")],
      (id) => (id === "reviewer.security" || id === "reviewer.ghost" ? okEntry : null),
      ["reviewer.security", "reviewer.ghost"],
    )
    expect(drifts.join(" ")).toMatch(/reviewer\.ghost/)
    expect(drifts.join(" ")).toMatch(/no registry file|missing/i)
  })

  // M5 swapped the example ids, not the mechanism. reviewer.migration and
  // reviewer.infra came OFF the exempt list — both are status: implemented, both
  // spawn at L2+, and both emit `high`, the loudest severity in the cluster, so
  // their absence from plugins/sgc/agents/reviewer/ was an oversight wearing an
  // exemption's clothes. They have files now. clarifier.discover and
  // planner.decompose remain genuinely exempt (LLM-backed, dispatched by
  // `sgc discover` / `sgc plan`, no registry file by design).
  test("an id exempted on purpose is not reported", () => {
    const drifts = agentMetadataDrift([], () => okEntry, ["clarifier.discover", "planner.decompose"])
    expect(drifts).toEqual([])
  })

  test("reviewer.migration / reviewer.infra are NO LONGER exempt — a missing file must fail", () => {
    // Guards the M4 decision from being quietly restored: with no registry files
    // supplied, both must now be reported as missing.
    const drifts = agentMetadataDrift([], () => okEntry, ["reviewer.migration", "reviewer.infra"])
    expect(drifts).toHaveLength(2)
    expect(drifts.join(" ")).toMatch(/reviewer\.migration.*missing/)
    expect(drifts.join(" ")).toMatch(/reviewer\.infra.*missing/)
  })

  test("the live repo passes both directions", () => {
    const drifts = agentMetadataDrift(readAgentMdFiles(ROOT), lookupReal, allManifestIds())
    expect(drifts).toEqual([])
  })
})

describe("M4 · check (N) reads frontmatter as YAML, not as a regex", () => {
  test("an unquoted description is understood", () => {
    // `/description:\s*"([^"]*)"/` only matches double-quoted single-line YAML.
    // An unquoted description is valid YAML and yielded desc = "" → drift, with
    // a message accusing it of not disclosing what it discloses perfectly.
    const f: AgentMdFile = {
      id: "reviewer.security",
      file: "plugins/sgc/agents/reviewer/security.md",
      text: `---\nname: reviewer-security\ndescription: Heuristic keyword matcher, not LLM-backed.\n---\n\nbody\n`,
    }
    expect(agentMetadataDrift([f], () => okEntry)).toEqual([])
  })

  test("a single-quoted description is understood", () => {
    const f: AgentMdFile = {
      id: "reviewer.security",
      file: "plugins/sgc/agents/reviewer/security.md",
      text: `---\nname: reviewer-security\ndescription: 'Heuristic keyword matcher, not LLM-backed.'\n---\n\nbody\n`,
    }
    expect(agentMetadataDrift([f], () => okEntry)).toEqual([])
  })

  test("a description with an escaped quote is not truncated", () => {
    const f: AgentMdFile = {
      id: "reviewer.security",
      file: "plugins/sgc/agents/reviewer/security.md",
      text: `---\nname: reviewer-security\ndescription: "Matches the word \\"token\\" — heuristic, not LLM-backed."\n---\n\nbody\n`,
    }
    expect(agentMetadataDrift([f], () => okEntry)).toEqual([])
  })

  test("malformed frontmatter fails closed rather than passing silently", () => {
    const f: AgentMdFile = {
      id: "reviewer.security",
      file: "plugins/sgc/agents/reviewer/security.md",
      text: `---\nname: [unclosed\ndescription: "heuristic"\n---\n\nbody\n`,
    }
    expect(agentMetadataDrift([f], () => okEntry).length).toBe(1)
  })
})

describe("M4 · a slot-only agent may not also claim to be dispatched", () => {
  test("'not wired' in a parenthetical does not license the overclaim", () => {
    // Demonstrated by the reviewer against the live check: this exact string
    // passed, because the parenthetical satisfies /not wired/ while the sentence
    // restores the precise overclaim P3-2 removed.
    const d =
      "Adversarial reviewer: hunts race conditions and logic inversions. Dispatched by /review for L2+ tasks. (The legacy stub is not wired.)"
    const drifts = agentMetadataDrift([file("reviewer.adversarial", d)], () => ({
      prompt_path: null,
      status: "slot-only",
    }))
    expect(drifts.length).toBe(1)
    expect(drifts[0]).toMatch(/dispatched/i)
  })

  test("an honest slot-only description still passes", () => {
    const d = "NOT IMPLEMENTED (slot-only): nothing dispatches this id today."
    expect(
      agentMetadataDrift([file("reviewer.adversarial", d)], () => ({
        prompt_path: null,
        status: "slot-only",
      })),
    ).toEqual([])
  })
})
