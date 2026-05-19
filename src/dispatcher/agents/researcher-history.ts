// researcher.history — prior-art miner.
//
// Two modes share one corpus walker (walkSolutionsCorpus):
//   - heuristic (researcherHistoryHeuristic): keyword-overlap score over
//     .sgc/solutions/, 0.3 floor, top-5 (Phase D / H.1).
//   - LLM rerank (Phase H): preFilterSolutions emits top-20 candidates;
//     the LLM picks + scores via prompts/researcher-history.md, output
//     normalized by coerceLlmOutput (6 guards incl. dedup).
//
// git-log integration is still deferred to when the compound cluster
// ships real solution entries (D-phase Step 6, not yet scheduled).
//
// Unlike reviewers and qa (Invariant §1 forbids read:solutions),
// researcher.* is granted read:solutions. Enforced via the manifest's
// scope_tokens + computeSubagentTokens — not redundantly here.

import { existsSync, readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { tokenize } from "../dedup"
import type { Logger } from "../logger"
import type { SolutionCategory } from "../types"
import { OutputShapeMismatch } from "../validation"

export interface ResearcherHistoryInput {
  intent_draft: string
}

export interface PriorArt {
  source: "solutions" | "git"
  relevance_score: number
  excerpt: string
  solution_ref?: string
  relevance_reason?: string  // LLM mode required, heuristic omits
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
 * (Internal) Walk .sgc/solutions/<cat>/*.md once. Yields one SolutionScan
 * per file with ≥1 keyword hit; NFC-normalizes file content up front so
 * callers read `.afterFence` / `.text` without re-normalizing (Phase H
 * pre-ship review I-9: was double-normalizing in preFilter).
 *
 * Shared by preFilterSolutions (LLM-mode candidate gathering) and
 * mineSolutions (heuristic-mode output) — both previously duplicated
 * ~40 lines of category/file walk (H.1 finding I-3, DRY).
 *
 * Returns [] when solutions/ is absent, keywords is empty, or the
 * top-level readdir fails. Per-category / per-file errors are skipped.
 */
interface SolutionScan {
  category: SolutionCategory
  slug: string
  hits: number
  /** Body after frontmatter fence, NFC-normalized, leading whitespace trimmed. */
  afterFence: string
  /** Full file text, NFC-normalized. Used for frontmatter introspection. */
  text: string
}

function walkSolutionsCorpus(
  stateRoot: string,
  keywords: string[],
): SolutionScan[] {
  const dir = resolve(stateRoot, "solutions")
  if (!existsSync(dir) || keywords.length === 0) return []

  let categories: string[]
  try {
    categories = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  } catch {
    return []
  }

  const out: SolutionScan[] = []
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
      let raw: string
      try {
        raw = readFileSync(filePath, "utf8")
      } catch {
        continue
      }
      const text = raw.normalize("NFC")
      const lower = text.toLowerCase()
      const hits = keywords.filter((k) => lower.includes(k)).length
      if (hits === 0) continue
      const afterFence = text.replace(/^---[\s\S]*?---\r?\n?/, "").trimStart()
      out.push({
        category: cat as SolutionCategory,
        slug: file.replace(/\.md$/, ""),
        hits,
        text,
        afterFence,
      })
    }
  }
  return out
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
  stateRoot?: string,
): PriorArtCandidate[] {
  // Canonical 3-step state-root fallback (mirrors researcherHistoryHeuristic):
  // explicit arg → SGC_STATE_ROOT env → ".sgc". Centralizing here prevents
  // call sites from accidentally bypassing the env var (T6 review C-1).
  const root = stateRoot ?? process.env["SGC_STATE_ROOT"] ?? ".sgc"
  const keywords = extractKeywords(intentDraft)
  const scans = walkSolutionsCorpus(root, keywords)

  const candidates: PriorArtCandidate[] = scans.map((s) => {
    const intentMatch = /^intent:\s*(.+)$/m.exec(s.text)
    const intentLine = intentMatch ? `${intentMatch[1]!.trim()}\n` : ""
    // afterFence is already NFC-normalized; concat + whitespace fold preserves NFC.
    const excerpt = (intentLine + s.afterFence)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500)
    return {
      solution_ref: `${s.category}/${s.slug}`,
      category: s.category,
      excerpt,
      keyword_hits: s.hits,
    }
  })

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
  const scans = walkSolutionsCorpus(stateRoot, keywords)
  const results: PriorArt[] = scans.map((s) => ({
    source: "solutions" as const,
    relevance_score: scoreRelevance(s.hits, keywords.length),
    excerpt: s.afterFence.slice(0, 160).replace(/\s+/g, " ").trim(),
    solution_ref: `${s.category}/${s.slug}`,
  }))
  results.sort((a, b) => b.relevance_score - a.relevance_score)
  // H.1: floor at 0.3 to align with LLM mode (coerceLlmOutput Guard 3). Same
  // intent → same intent.md regardless of env. Pre-H.1 heuristic emitted
  // sub-0.3 weak matches that LLM mode would have rejected.
  return results.filter((r) => r.relevance_score >= 0.3).slice(0, 5)
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

/**
 * Post-spawn validation + coercion for LLM-mode researcher.history output.
 *
 * Lives here (not in validation.ts) because validation.ts is manifest-driven
 * and only handles enum[...] / array[<simple>] per the comment at
 * validation.ts:55-63 — composite array[{...}] inner shape is deferred to
 * per-agent code. Mirrors how planner.eng + compound.context handle their
 * nested shapes via prompt + post-spawn convention.
 *
 * 6 guards:
 *   1. prior_art is array
 *   2. each entry's solution_ref ∈ candidates set
 *   3. relevance_score ∈ [0, 1] always; tightened to [0.3, 1] when
 *      relevance_reason present (LLM mode). Heuristic mode also floors at
 *      0.3 since H.1 (see mineSolutions); coerce stays tolerant for legacy.
 *   4. relevance_reason — when present, must be non-empty (LLM mode);
 *      absent is legal (heuristic mode passes through coerce)
 *   5. truncate prior_art > 5 to first 5 unique (tolerant)
 *   6. duplicate solution_ref — first wins; subsequent dropped silently and
 *      surfaced via a single dedup warning in output.warnings (H.1).
 *
 * Back-fills `excerpt` and `source` from the candidates map so the LLM
 * doesn't have to re-emit ~500-char strings (saves output tokens; defense
 * against the LLM mangling the excerpt).
 */
export function coerceLlmOutput(
  raw: unknown,
  candidates: PriorArtCandidate[],
): ResearcherHistoryOutput {
  if (typeof raw !== "object" || raw === null) {
    throw new OutputShapeMismatch(
      "researcher.history",
      ["prior_art"],
      "researcher.history output not an object",
    )
  }
  const obj = raw as Record<string, unknown>
  // Guard 1: prior_art is array
  if (!Array.isArray(obj.prior_art)) {
    throw new OutputShapeMismatch(
      "researcher.history",
      ["prior_art"],
      `researcher.history.prior_art expected array, got ${typeof obj.prior_art}`,
    )
  }
  const refSet = new Set(candidates.map((c) => c.solution_ref))
  const candByRef = new Map(candidates.map((c) => [c.solution_ref, c]))

  // Guards 5 + 6: iterate full array; track seen refs (dedup first-wins) and
  // stop once 5 unique entries are collected (truncate). Pre-H.1 pre-sliced to
  // first 5 raw entries, which dropped valid uniques when the first 5 had
  // duplicate refs.
  const seenRefs = new Set<string>()
  let dedupedCount = 0
  const out_prior_art: PriorArt[] = []
  for (let i = 0; i < obj.prior_art.length; i++) {
    if (out_prior_art.length >= 5) break
    const e = obj.prior_art[i]
    if (typeof e !== "object" || e === null) {
      throw new OutputShapeMismatch(
        "researcher.history",
        [`prior_art[${i}]`],
        `prior_art[${i}] not an object`,
      )
    }
    const entry = e as Record<string, unknown>
    const ref = entry.solution_ref
    // Guard 2: ref must exist in input candidates
    if (typeof ref !== "string" || !refSet.has(ref)) {
      throw new OutputShapeMismatch(
        "researcher.history",
        [`prior_art[${i}].solution_ref`],
        `prior_art[${i}].solution_ref ${JSON.stringify(ref)} not in input candidates`,
      )
    }
    // Guard 3: relevance_score must be number in [0, 1]; LLM mode (relevance_reason
    // present) tightens to [0.3, 1.0]. Heuristic mode emits raw hit-rate which
    // may be below 0.3; still legal.
    const score = entry.relevance_score
    const hasReason = entry.relevance_reason !== undefined
    // !Number.isFinite catches NaN, +Infinity, -Infinity (and non-numbers,
    // making the typeof check redundant but kept for clearer error message).
    // Phase H pre-ship review F-2: bare `score < 0 || score > 1` admitted NaN
    // because typeof NaN === "number" + NaN-comparisons-are-false; YAML
    // `relevance_score: .nan` from a misbehaving LLM would render literal
    // "NaN" via .toFixed(2) into intent.md.
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1.0) {
      throw new OutputShapeMismatch(
        "researcher.history",
        [`prior_art[${i}].relevance_score`],
        `prior_art[${i}].relevance_score must be finite number in [0, 1], got ${typeof score === "number" ? String(score) : JSON.stringify(score)}`,
      )
    }
    if (hasReason && score < 0.3) {
      throw new OutputShapeMismatch(
        "researcher.history",
        [`prior_art[${i}].relevance_score`],
        `prior_art[${i}].relevance_score must be ≥ 0.3 in LLM mode (with relevance_reason), got ${score}`,
      )
    }
    // Guard 4: relevance_reason — when present, must be non-empty.
    // Heuristic-mode entries omit the field entirely (legal); LLM-mode
    // entries must populate it (validated below).
    const reason = entry.relevance_reason
    if (hasReason && (typeof reason !== "string" || reason.trim().length === 0)) {
      throw new OutputShapeMismatch(
        "researcher.history",
        [`prior_art[${i}].relevance_reason`],
        `prior_art[${i}].relevance_reason must be non-empty string when present`,
      )
    }
    // Guard 6: dedup by solution_ref, first-wins. Subsequent duplicates
    // dropped + counted; a single warning is surfaced after the loop.
    if (seenRefs.has(ref)) {
      dedupedCount++
      continue
    }
    seenRefs.add(ref)

    const cand = candByRef.get(ref)!
    const entryOut: PriorArt = {
      source: "solutions",
      solution_ref: ref,
      relevance_score: score,
      excerpt: cand.excerpt,
    }
    // Whitespace-fold: collapse \n / \r / tabs / runs into single spaces so a
    // misbehaving LLM emitting multi-line reasons can't break markdown list
    // continuation downstream (T6 review I-2 — defense in depth at boundary).
    if (hasReason) entryOut.relevance_reason = (reason as string).trim().replace(/\s+/g, " ")
    out_prior_art.push(entryOut)
  }

  const llmWarnings = Array.isArray(obj.warnings)
    ? (obj.warnings.filter((w) => typeof w === "string") as string[])
    : []
  const warnings = [...llmWarnings]
  if (dedupedCount > 0) {
    const noun = dedupedCount === 1 ? "entry" : "entries"
    warnings.push(
      `LLM emitted ${dedupedCount} duplicate solution_ref ${noun}; deduped to ${out_prior_art.length} unique`,
    )
  }

  return { prior_art: out_prior_art, warnings }
}

/**
 * Failure handler for the researcher.history pipeline (spawn or coerce throw).
 * Emits a `researcher.coerce_failed` Tier-2 audit event so operators can find
 * the failure via `sgc tail --agent researcher.history`, then returns the
 * synthetic empty-prior_art + warning shape that plan.ts substitutes so the
 * primary plan flow continues.
 *
 * Lives here (not inline in plan.ts) because the catch logic is part of the
 * agent's contract — extracted for unit-test coverage. spec §329 (failure
 * already audited via Invariant §13 Tier-2) is honored by this emission;
 * spawn() itself emits llm.response.outcome=success when the LLM call
 * succeeds, so coerce throws would otherwise be invisible to `sgc tail`.
 */
export function handleCoerceFailure(
  err: unknown,
  logger: Logger,
  taskId: string | null,
): ResearcherHistoryOutput {
  const errName = err instanceof Error ? err.name : "unknown"
  const errMsg = err instanceof Error ? err.message : ""
  logger.event({
    task_id: taskId,
    spawn_id: null,
    agent: "researcher.history",
    event_type: "researcher.coerce_failed",
    level: "warn",
    payload: { error_class: errName, error_message: errMsg },
  })
  return {
    prior_art: [],
    warnings: [
      `researcher.history failed: ${errName}${errMsg ? `: ${errMsg}` : ""}`,
    ],
  }
}
