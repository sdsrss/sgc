// classifier.level — heuristic stub.
//
// Replaces a real LLM call with keyword-based classification for MVP.
// Returns level + rationale + affected_readers_candidates per the
// manifest's outputs schema.
//
// Heuristic precedence (HARD escalation rules per skill spec):
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

export function classifierLevel(input: ClassifierInput): ClassifierOutput {
  const req = input.user_request

  if (L3_KEYWORDS.some((re) => re.test(req))) {
    return {
      level: "L3",
      rationale: "request mentions architecture/migration/infra keywords; minimum L3 per HARD escalation rule",
      affected_readers_candidates: ["dispatcher", "future maintainers"],
    }
  }
  if (L2_KEYWORDS.some((re) => re.test(req))) {
    return {
      level: "L2",
      rationale: "request involves public API/auth/payment surface; minimum L2 per HARD escalation rule",
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
    rationale: "default classification — single-file or simple change with no keyword hits for L0/L2/L3",
    affected_readers_candidates: ["dispatcher"],
  }
}
