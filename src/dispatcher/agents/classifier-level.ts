// classifier.level — heuristic fallback + LLM dispatch path.
//
// When spawn mode is inline (MVP, tests) → heuristic keyword classifier below.
// When mode is anthropic-sdk / claude-cli / file-poll → real LLM via
// prompts/classifier-level.md (routed by spawn.ts when manifest.prompt_path is set).
//
// Heuristic precedence (HARD escalation rules):
//   1. migration / infra / DB schema → L3
//   2. public API / auth / payment → at least L2
//   3. typo / format / comment / config-only → L0
//   4. otherwise → L1 (conservative default)

import type { Level } from "../types"

export interface ClassifierInput {
  user_request: string
  repo_summary?: string
}

export interface ClassifierOutput {
  level: Level
  rationale: string
  affected_readers_candidates: string[]
}

const L3_KEYWORDS = [
  /\bmigration\b/i,
  /\bschema\b/i,
  /\bDROP\b|\bALTER\b|\bCREATE TABLE\b/,
  /\binfra(structure)?\b/i,
  /\bdeploy(ment)?\b/i,
  /\barchitect(ure)?\b/i,
]

const L2_KEYWORDS = [
  /\bAPI\b/,
  /\bauth(entication|orization)?\b/i,
  /\bpayment\b/i,
  /\bcrypto\b|\bjwt\b|\btoken\b|\bsession\b/i,
  /\bmulti[- ]file\b/i,
  /\brefactor\b/i,
]

const L0_KEYWORDS = [
  /\btypo\b/i,
  /\bformat(ting)?\b/i,
  /\bcomment\b/i,
  /\brename (a )?(local )?variable\b/i,
  /\bdocstring\b/i,
  /^(fix|update) (a |the )?(typo|formatting|comment|whitespace|spelling)/i,
]

/** Heuristic fallback — used when no LLM is available (tests, inline mode). */
export function classifierLevelHeuristic(input: ClassifierInput): ClassifierOutput {
  const req = input.user_request

  if (L3_KEYWORDS.some((re) => re.test(req))) {
    return {
      level: "L3",
      rationale:
        "request mentions architecture/migration/infra keywords; minimum L3 per HARD escalation rule",
      affected_readers_candidates: ["dispatcher", "future maintainers"],
    }
  }
  if (L2_KEYWORDS.some((re) => re.test(req))) {
    return {
      level: "L2",
      rationale:
        "request involves public API/auth/payment surface; minimum L2 per HARD escalation rule",
      affected_readers_candidates: ["dispatcher", "downstream callers"],
    }
  }
  if (L0_KEYWORDS.some((re) => re.test(req))) {
    return {
      level: "L0",
      rationale: "request is a trivial text-only change (typo/format/comment); fast-path",
      affected_readers_candidates: ["dispatcher"],
    }
  }
  return {
    level: "L1",
    rationale:
      "default classification — single-file or simple change with no keyword hits for L0/L2/L3",
    affected_readers_candidates: ["dispatcher"],
  }
}

/** Backward-compat alias. Prefer the heuristic-specific name in new code. */
export const classifierLevel = classifierLevelHeuristic
