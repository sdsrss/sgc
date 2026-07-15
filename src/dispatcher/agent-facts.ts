// The derived half of an agent description.
//
// Every one of the 9 descriptions is two parts: a hand-written capability
// sentence (judgement — humans own it) and this clause (fact — the machine owns
// it). 8 of the 9 defects the M4+M5 reviews found lived in this half; none lived
// in the other. So this half is no longer written by hand.
//
// See docs/superpowers/specs/2026-07-15-agent-description-derivation-design.md

import { getSubagentManifest } from "./schema"
import { displayList } from "./agents/terms"
import { SECURITY, MIGRATION, PERFORMANCE, INFRA } from "./agents/reviewer-specialists"
import {
  MAINT_MARKER_TERMS, MAX_LINE, MAINTAINABILITY_SEVERITY,
  TESTS_SEVERITY, TESTS_MECHANISM,
} from "./agents/reviewer-quality"

/** Everything from here to the end of a description is machine-owned. */
export const CLI_FACT_MARKER = "Separate fact for sgc CLI users:"

export const DERIVED_AGENT_IDS: readonly string[] = [
  "reviewer.security", "reviewer.tests", "reviewer.performance",
  "reviewer.maintainability", "reviewer.migration", "reviewer.infra",
  "reviewer.adversarial", "reviewer.spec", "janitor.archive",
]

const NO_BODY = "`sgc review` does not run this file's body"

function fallbackTerms(id: string): string {
  switch (id) {
    case "reviewer.security": return displayList(SECURITY.terms)
    case "reviewer.migration": return displayList(MIGRATION.terms)
    case "reviewer.performance": return displayList(PERFORMANCE.terms)
    case "reviewer.infra": return displayList(INFRA.terms)
    default: throw new Error(`${id} has no term list`)
  }
}

function severityOf(id: string): string {
  switch (id) {
    case "reviewer.security": return SECURITY.severity
    case "reviewer.migration": return MIGRATION.severity
    case "reviewer.performance": return PERFORMANCE.severity
    case "reviewer.infra": return INFRA.severity
    case "reviewer.tests": return TESTS_SEVERITY
    case "reviewer.maintainability": return MAINTAINABILITY_SEVERITY
    default: throw new Error(`${id} has no severity`)
  }
}

export function deriveCliFact(agentId: string): string {
  if (!DERIVED_AGENT_IDS.includes(agentId)) {
    throw new Error(`${agentId} is not in the derived set — see DERIVED_AGENT_IDS`)
  }
  const m = getSubagentManifest(agentId)
  if (!m) throw new Error(`${agentId} has no manifest entry`)

  // Shape 4 — the CLI never runs it at all.
  if (m.status === "slot-only" || m.status === "manual-only") {
    const why =
      agentId === "janitor.archive"
        ? "there is no archive command and no janitor-archive module"
        : "this id is not wired into the CLI"
    return `${CLI_FACT_MARKER} ${why} (manifest status: ${m.status}), so \`sgc review\` never produces a result for it — Claude Code dispatch is the only executor.`
  }

  // Shape 2 — LLM-backed, with the heuristic as fallback.
  if (m.prompt_path) {
    const fb =
      agentId === "reviewer.tests"
        ? `${TESTS_MECHANISM} that only asks whether test files were touched, at ${severityOf(agentId)} severity`
        : `a keyword matcher (${fallbackTerms(agentId)}) at ${severityOf(agentId)} severity`
    return `${CLI_FACT_MARKER} ${NO_BODY} — with an API key it runs ${m.prompt_path}; without one it falls back to ${fb}.`
  }

  // Shape 3 — threshold + marker list.
  if (agentId === "reviewer.maintainability") {
    return `${CLI_FACT_MARKER} ${NO_BODY} — there, reviewer.maintainability is a heuristic matcher over added lines: longer than ${MAX_LINE} characters, or carrying a suppression marker (${displayList(MAINT_MARKER_TERMS)}), at ${MAINTAINABILITY_SEVERITY} severity. That is the whole of it.`
  }

  // Shape 1 — term-list matcher, no LLM path.
  return `${CLI_FACT_MARKER} ${NO_BODY} — there, ${agentId} is a heuristic keyword matcher over added lines (${fallbackTerms(agentId)}) at ${severityOf(agentId)} severity, which matches words about the problem rather than detecting it. Its spawn trigger is deliberately wider than that matcher, so a spawned reviewer reporting zero findings is not evidence of a clean diff.`
}
