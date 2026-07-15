// P3-2 regression: the agent registry Claude Code reads must not overclaim.
//
// `plugins/sgc/agents/**/*.md` are Claude Code subagent definitions. Their
// frontmatter `description:` is LLM-visible metadata — it is what a model reads
// when deciding whether it has a capability. Nothing bound those descriptions to
// the manifest, so they drifted into advertising work the runtime does not do:
//
//   reviewer/security.md   "Hunts for ... OWASP Top 10 vulnerabilities"
//                          → runtime: /(auth|jwt|token|secret|crypto)/i regex
//   reviewer/adversarial.md "Dispatched by /review for L2+ tasks"
//                          → manifest: status slot-only. Never dispatched. At all.
//
// doctor already binds prompts↔manifest (check B) and slash↔CLI (check H); this
// third registry had no gate, which is exactly why it rotted. A model that
// believes it has an OWASP-grade reviewer routes work to a regex.

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { agentMetadataDrift, readAgentMdFiles } from "../../src/commands/doctor"
import { getSubagentManifest } from "../../src/dispatcher/schema"
import type { ManifestLookup } from "../../src/commands/doctor"

const REPO = resolve(import.meta.dir, "..", "..")

/** The real parser, as doctor wires it. */
const REAL_LOOKUP: ManifestLookup = (id) => getSubagentManifest(id) ?? null

/** Minimal lookup for the unit cases: one LLM-backed, one heuristic, one slot-only. */
const FAKE_MANIFEST: ManifestLookup = (id) =>
  ({
    "alpha.llm": { prompt_path: "prompts/planner-eng.md", status: "implemented" },
    "alpha.heuristic": { prompt_path: null, status: "implemented" },
    "alpha.slot": { prompt_path: null, status: "slot-only" },
  })[id] ?? null

const md = (desc: string) => `---\nname: x\ndescription: "${desc}"\n---\n\n# X\n`

describe("agentMetadataDrift (P3-2)", () => {
  test("a slot-only agent whose description claims it is dispatched → drift", () => {
    const drifts = agentMetadataDrift(
      [{ id: "alpha.slot", file: "agents/alpha/slot.md", text: md("Does the thing. Dispatched by /review for L2+ tasks.") }],
      FAKE_MANIFEST,
    )
    expect(drifts.length).toBe(1)
    expect(drifts[0]).toContain("alpha.slot")
    expect(drifts[0]!.toLowerCase()).toMatch(/slot-only|not implemented|never dispatched/)
  })

  test("a slot-only agent that says so → no drift", () => {
    const drifts = agentMetadataDrift(
      [{ id: "alpha.slot", file: "agents/alpha/slot.md", text: md("NOT IMPLEMENTED (slot-only): reserved, never dispatched.") }],
      FAKE_MANIFEST,
    )
    expect(drifts).toEqual([])
  })

  test("a heuristic agent whose description implies semantic analysis → drift", () => {
    const drifts = agentMetadataDrift(
      [{ id: "alpha.heuristic", file: "agents/alpha/h.md", text: md("Hunts for OWASP Top 10 vulnerabilities and auth bypass.") }],
      FAKE_MANIFEST,
    )
    expect(drifts.length).toBe(1)
    expect(drifts[0]!.toLowerCase()).toMatch(/heuristic/)
  })

  test("a heuristic agent that discloses it is a keyword matcher → no drift", () => {
    const drifts = agentMetadataDrift(
      [{ id: "alpha.heuristic", file: "agents/alpha/h.md", text: md("Heuristic keyword matcher (not LLM-backed): flags lines matching auth/crypto.") }],
      FAKE_MANIFEST,
    )
    expect(drifts).toEqual([])
  })

  test("an LLM-backed agent needs no caveat", () => {
    const drifts = agentMetadataDrift(
      [{ id: "alpha.llm", file: "agents/alpha/llm.md", text: md("Hunts for logic errors, edge cases, and broken error propagation.") }],
      FAKE_MANIFEST,
    )
    expect(drifts).toEqual([])
  })

  test("an agent .md with no manifest entry → drift (orphan registry file)", () => {
    const drifts = agentMetadataDrift(
      [{ id: "ghost.agent", file: "agents/ghost/agent.md", text: md("A reviewer that does not exist.") }],
      FAKE_MANIFEST,
    )
    expect(drifts.length).toBe(1)
    expect(drifts[0]).toContain("ghost.agent")
  })

  test("THE REAL agent registry matches THE REAL manifest", () => {
    // The check that would have caught the shipped overclaims.
    const files = readAgentMdFiles(REPO)
    expect(files.length).toBeGreaterThan(10) // sanity: we actually found the registry
    expect(agentMetadataDrift(files, REAL_LOOKUP)).toEqual([])
  })
})
