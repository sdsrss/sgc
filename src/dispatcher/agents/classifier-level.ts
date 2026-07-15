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

// Security/auth surface — same "at least L2" rule as L2_KEYWORDS, split out for
// rationale. The original L2 set covered auth/payment/token/session but missed
// the most common security phrasings, so e.g. "add rate limiting to the login
// endpoint" fell through to L1 and skipped the independent review + qa gate
// exactly where they matter most. Deliberately high-signal / low-false-positive
// (no bare `permission`/`access`, which appear in non-security UI tasks). The
// strong-L0 short-circuit still runs first, so a genuine "fix login-page typo"
// stays L0.
const SECURITY_KEYWORDS = [
  /\blog[- ]?in\b|\bsign[- ]?in\b|\bsign[- ]?up\b|\bsignup\b|\bsignin\b/i,
  /\bpassword\b|\bpasswd\b|\bcredentials?\b/i,
  /\boauth\b|\bopenid\b|\bsaml\b|\bsso\b/i,
  /\b2fa\b|\bmfa\b|\botp\b/i,
  /\bcsrf\b|\bxss\b|\binjection\b|\bvulnerabilit(y|ies)\b|\bexploit\b/i,
  /\brate[- ]?limit(ing|ed|er|s)?\b|\bthrottl(e|ing|ed)\b/i,
]

// ALG-5: unambiguous trivial-edit markers that WIN over incidental L2/L3
// keyword mentions. Checked before L3/L2 so "fix the API docs typo" (typo) and
// "rename the token variable" (variable rename) classify L0 instead of being
// force-escalated by the API/token keyword. Deliberately narrow — only edit
// types that are trivial regardless of subject — because under-classification
// (skipping review on a real change) is more dangerous than over-classifying.
const STRONG_L0 = [
  /\btypos?\b/i,
  /\b(misspelling|spelling)\b/i,
  /\brename\b[^.]{0,40}\bvariable\b/i,
]

// ALG-5: tightened from the pre-fix set. Dropped bare `/\bformat(ting)?\b/`
// (matched "format dates" → mis-classified a feature as L0) and bare
// `/\bcomment\b/` (matched "add a comment column" → likewise). The anchored
// `^(fix|update) ... comment` pattern still catches genuine comment-wording
// edits.
const L0_KEYWORDS = [
  /\btypos?\b/i,
  /\b(misspelling|spelling)\b/i,
  /\breformat(ting)?\b/i,
  /\bformatting\b/i,
  /\bwhitespace\b/i,
  /\bindentation\b/i,
  /\bcode comments?\b/i,
  /\bdocstrings?\b/i,
  /\brename (a |the )?(local )?variable\b/i,
  /^(fix|update) (a |the )?(typo|formatting|comment|whitespace|spelling|docstring)/i,
]

/** Heuristic fallback — used when no LLM is available (tests, inline mode). */
export function classifierLevelHeuristic(input: ClassifierInput): ClassifierOutput {
  const req = input.user_request

  // ALG-5: strong-L0 short-circuit runs FIRST — an unambiguous trivial edit
  // beats an incidental L2/L3 keyword.
  if (STRONG_L0.some((re) => re.test(req))) {
    return {
      level: "L0",
      rationale:
        "request is an unambiguous trivial edit (typo/spelling/variable-rename); fast-path despite any incidental API/schema keyword",
      affected_readers_candidates: ["dispatcher"],
    }
  }

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
  if (SECURITY_KEYWORDS.some((re) => re.test(req))) {
    return {
      level: "L2",
      rationale:
        "request touches security/auth surface (login/credential/oauth/vuln/rate-limit); minimum L2 so the change gets independent review + qa gate",
      affected_readers_candidates: ["dispatcher", "downstream callers", "security reviewers"],
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

export const LEVEL_RANK: Record<Level, number> = { L0: 0, L1: 1, L2: 2, L3: 3 }

/**
 * P1-1 (audit v1.31.8): deterministic escalation floor over an LLM verdict.
 *
 * `classifier.level` has a `prompt_path`, so whenever an API key is present
 * spawn routes to the LLM and the heuristic above — which is where the HARD
 * escalation rules actually live as code — never runs. The prompt restates
 * those rules, but a prompt is advisory: `validateOutputShape` only checks the
 * value is one of L0..L3, not that it clears the floor. Since the level decides
 * whether the planner cluster, the adversarial pre-mortem, and the review + qa
 * gates run at all, an under-classifying LLM call silently disarmed every
 * downstream gate.
 *
 * The rule is `max(heuristic, llm)`: the LLM may escalate above the floor (it
 * sees nuance the regexes can't), never below it. This mirrors the discipline
 * `compound.related` already applies — see agents/compound.ts, kept permanently
 * heuristic so an LLM cannot mint a dedup stamp past the §3 write gate. LLM
 * proposes, deterministic code adjudicates.
 *
 * Idempotent on heuristic output, so the inline/stub path is a no-op.
 */
export function applyHeuristicFloor(
  llm: ClassifierOutput,
  input: ClassifierInput,
): ClassifierOutput {
  const floor = classifierLevelHeuristic(input)
  if (LEVEL_RANK[llm.level] >= LEVEL_RANK[floor.level]) return llm
  return {
    level: floor.level,
    // Invariant §11 wants a concrete rationale; an escalation that hides which
    // verdict it overrode is unauditable after the fact, so record both.
    rationale:
      `${floor.rationale} [deterministic heuristic floor raised ${llm.level} → ${floor.level}; ` +
      `LLM verdict was: ${llm.rationale}]`,
    affected_readers_candidates: [
      ...new Set([...floor.affected_readers_candidates, ...llm.affected_readers_candidates]),
    ],
  }
}
