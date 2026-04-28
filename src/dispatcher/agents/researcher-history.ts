// researcher.history — prior-art miner stub.
//
// Real researcher.history would grep git log + solutions/ with semantic
// similarity. MVP stub does a cheap keyword scan of .sgc/solutions/ only
// (git log integration deferred to when compound cluster ships real
// solution entries — D-phase Step 6).
//
// Unlike reviewers and qa (Invariant §1 forbids read:solutions),
// researcher.* is granted read:solutions. Enforced via the manifest's
// scope_tokens + computeSubagentTokens — not redundantly here.

import { existsSync, readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { tokenize } from "../dedup"
import type { SolutionCategory } from "../types"

export interface ResearcherHistoryInput {
  intent_draft: string
}

export interface PriorArt {
  source: "solutions" | "git"
  relevance_score: number
  excerpt: string
  solution_ref?: string
}

export interface ResearcherHistoryOutput {
  prior_art: PriorArt[]
  warnings: string[]
}

export interface ResearcherHistoryOptions {
  stateRoot?: string
}

export interface PriorArtCandidate {
  solution_ref: string         // "<category>/<slug>"
  category: SolutionCategory   // existing enum from types.ts
  excerpt: string              // ≤ 500 chars (NFC normalized, whitespace folded)
  keyword_hits: number         // # keyword overlaps (transparent to LLM)
}

/**
 * Pre-filter the solutions corpus by keyword overlap. Returns at most
 * 20 candidates (or all if corpus ≤ 20). Used by plan.ts before the
 * spawn("researcher.history") call: zero candidates short-circuits the
 * spawn entirely; non-zero candidates flow into the LLM as `input.candidates`.
 *
 * Reuses dedup.ts:tokenize for NFC + Intl.Segmenter — single source of
 * tokenization truth across dedup.ts and researcher-history.ts.
 */
export function preFilterSolutions(
  intentDraft: string,
  stateRoot: string,
): PriorArtCandidate[] {
  const dir = resolve(stateRoot, "solutions")
  if (!existsSync(dir)) return []

  const keywords = extractKeywords(intentDraft)
  if (keywords.length === 0) return []

  let categories: string[]
  try {
    categories = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  } catch {
    return []
  }

  const candidates: PriorArtCandidate[] = []
  for (const cat of categories) {
    const catPath = resolve(dir, cat)
    let files: string[]
    try {
      files = readdirSync(catPath, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith(".md"))
        .map((e) => e.name)
    } catch {
      continue
    }
    for (const file of files) {
      const filePath = resolve(catPath, file)
      let text: string
      try {
        text = readFileSync(filePath, "utf8")
      } catch {
        continue
      }
      const lower = text.toLowerCase()
      const hits = keywords.filter((k) => lower.includes(k)).length
      if (hits === 0) continue
      // Build excerpt: prefer frontmatter intent + body prefix, cap 500.
      const afterFence = text.replace(/^---[\s\S]*?---\r?\n?/, "").trimStart()
      const intentMatch = /^intent:\s*(.+)$/m.exec(text)
      const intentLine = intentMatch ? `${intentMatch[1]!.trim()}\n` : ""
      const excerpt = (intentLine + afterFence)
        .normalize("NFC")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500)
      candidates.push({
        solution_ref: `${cat}/${file.replace(/\.md$/, "")}`,
        category: cat as SolutionCategory,
        excerpt,
        keyword_hits: hits,
      })
    }
  }

  // Top-N=20 by keyword hits (descending). When corpus ≤ 20, all pass.
  candidates.sort((a, b) => b.keyword_hits - a.keyword_hits)
  return candidates.slice(0, 20)
}

function extractKeywords(text: string): string[] {
  // Reuse dedup.ts tokenize: NFC + Intl.Segmenter (ICU word-granularity,
  // script-aware length floor — ASCII ≥3, non-ASCII ≥2). Single source of
  // truth for tokenization across dedup.ts and researcher-history.ts.
  return Array.from(tokenize(text))
}

function scoreRelevance(hitCount: number, keywordCount: number): number {
  if (keywordCount === 0) return 0
  // Normalized hit rate, capped at 1.0
  return Math.min(1, hitCount / keywordCount)
}

function mineSolutions(stateRoot: string, keywords: string[]): PriorArt[] {
  const dir = resolve(stateRoot, "solutions")
  if (!existsSync(dir) || keywords.length === 0) return []

  const results: PriorArt[] = []
  let categories: string[]
  try {
    categories = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  } catch {
    return []
  }

  for (const cat of categories) {
    const catPath = resolve(dir, cat)
    let files: string[]
    try {
      files = readdirSync(catPath, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith(".md"))
        .map((e) => e.name)
    } catch {
      continue
    }
    for (const file of files) {
      const filePath = resolve(catPath, file)
      let text: string
      try {
        text = readFileSync(filePath, "utf8")
      } catch {
        continue
      }
      const lower = text.toLowerCase()
      const hits = keywords.filter((k) => lower.includes(k)).length
      if (hits === 0) continue
      const score = scoreRelevance(hits, keywords.length)
      // Skip bodies' frontmatter for the excerpt snippet
      const afterFence = text.replace(/^---[\s\S]*?---\r?\n?/, "").trimStart()
      const excerpt = afterFence.slice(0, 160).replace(/\s+/g, " ").trim()
      const slug = file.replace(/\.md$/, "")
      results.push({
        source: "solutions",
        relevance_score: score,
        excerpt,
        solution_ref: `${cat}/${slug}`,
      })
    }
  }
  results.sort((a, b) => b.relevance_score - a.relevance_score)
  return results.slice(0, 5)
}

export function researcherHistoryHeuristic(
  input: ResearcherHistoryInput,
  opts: ResearcherHistoryOptions = {},
): ResearcherHistoryOutput {
  const stateRoot =
    opts.stateRoot ?? process.env["SGC_STATE_ROOT"] ?? ".sgc"
  const keywords = extractKeywords(input.intent_draft ?? "")

  const prior_art = mineSolutions(stateRoot, keywords)
  const warnings: string[] = []

  if (keywords.length === 0) {
    warnings.push(
      "intent_draft produced no keywords (too short or stopwords only); no scan performed",
    )
  }
  if (
    prior_art.length === 0 &&
    keywords.length > 0 &&
    existsSync(resolve(stateRoot, "solutions"))
  ) {
    warnings.push("no relevant prior solutions found in .sgc/solutions/")
  }

  return { prior_art, warnings }
}

// Backwards-compat alias for callers that pre-date the LLM swap (Phase F/G.2
// pattern). plan.ts inlineStub still imports `researcherHistory`; tests using
// the legacy name continue to work.
export const researcherHistory = researcherHistoryHeuristic
