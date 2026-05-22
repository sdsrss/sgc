// researcher.history — prior-art miner.
//
// Two modes share one corpus walker (walkSolutionsCorpus):
//   - heuristic (researcherHistoryHeuristic): keyword-overlap score over
//     .sgc/solutions/, 0.3 floor, top-5 (Phase D / H.1).
//   - LLM rerank (Phase H): preFilterSolutions emits top-20 candidates;
//     the LLM picks + scores via prompts/researcher-history.md, output
//     normalized by coerceLlmOutput (6 guards incl. dedup).
//
// FS reads are async (node:fs/promises) so the IIFE in plan.ts that
// builds the L2/L3 spawn cluster doesn't block sibling spawn starts
// on the directory walk (H.1 #4), and the walk scales past ~500
// solution files without blocking the event loop (H.1 #5).
//
// git-log integration is still deferred to when the compound cluster
// ships real solution entries (D-phase Step 6, not yet scheduled).
//
// Unlike reviewers and qa (Invariant §1 forbids read:solutions),
// researcher.* is granted read:solutions. Enforced via the manifest's
// scope_tokens + computeSubagentTokens — not redundantly here.

import { existsSync } from "node:fs"
import { readFile, readdir, stat } from "node:fs/promises"
import { resolve } from "node:path"
import { tokenize } from "../dedup"
import type { Logger } from "../logger"
import { resolveStateRoot } from "../state"
import type { SolutionCategory } from "../types"
import { OutputShapeMismatch, composeArrayObjectValidator } from "../validation"

// CE-1.1 L1.e: defensive cap on per-file size in walkSolutionsCorpus.
// 256 KB is well above any plausible compound-written solution
// (frontmatter + 5-line prevention + narrative body — typically < 4 KB)
// while protecting the dispatcher from accidental log dumps, screenshot
// blobs, or pathological copy-paste leaving multi-MB markdown in
// solutions/. Files at or below the cap are read whole; oversize files
// are skipped silently — they are operator misuse, not a runtime mode.
const MAX_SOLUTION_FILE_BYTES = 256 * 1024

export interface ResearcherHistoryInput {
  intent_draft: string
  /**
   * Pre-filtered solution candidates from `preFilterSolutions`, supplied
   * before `spawn("researcher.history")` by `plan.ts`. Required at runtime
   * in LLM mode (the prompt references `candidates`); heuristic mode
   * (`researcherHistoryHeuristic`) ignores them and mines solutions/ itself.
   * TS marks optional so unit tests can construct input without going
   * through preFilterSolutions; production spawn always supplies it.
   * Manifest declares `candidates: array[{...}]` at sgc-capabilities.yaml:302
   * (H.1 #7 — field was previously absent from TS).
   */
  candidates?: PriorArtCandidate[]
}

export interface PriorArt {
  source: "solutions" | "git"
  relevance_score: number
  excerpt: string
  // Required at runtime in both modes: heuristic mode always emits
  // `${category}/${slug}` (mineSolutions); LLM mode is gated by
  // coerceLlmOutput Guard 2 (ref must be in candidates set). Matches
  // YAML manifest `solution_ref` without `?` (H.1 #8).
  solution_ref: string
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
export interface SolutionScan {
  category: SolutionCategory
  slug: string
  hits: number
  /** Body after frontmatter fence, NFC-normalized, leading whitespace trimmed. */
  afterFence: string
  /** Full file text, NFC-normalized. Used for frontmatter introspection. */
  text: string
}

export async function walkSolutionsCorpus(
  stateRoot: string,
  keywords: string[],
): Promise<SolutionScan[]> {
  const dir = resolve(stateRoot, "solutions")
  if (keywords.length === 0) return []

  let categories: string[]
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    categories = entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    // Missing solutions/ dir or unreadable — treat as empty corpus.
    return []
  }

  const out: SolutionScan[] = []
  for (const cat of categories) {
    const catPath = resolve(dir, cat)
    let files: string[]
    try {
      const entries = await readdir(catPath, { withFileTypes: true })
      files = entries
        .filter((e) => e.isFile() && e.name.endsWith(".md"))
        .map((e) => e.name)
    } catch {
      continue
    }
    for (const file of files) {
      const filePath = resolve(catPath, file)
      let raw: string
      try {
        // CE-1.1 L1.e: stat first, skip oversize files before allocating
        // a multi-MB string for keyword scan / NFC normalize.
        const st = await stat(filePath)
        if (st.size > MAX_SOLUTION_FILE_BYTES) continue
        raw = await readFile(filePath, "utf8")
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
export async function preFilterSolutions(
  intentDraft: string,
  stateRoot?: string,
): Promise<PriorArtCandidate[]> {
  // CE-1.1 L1.b: lifted to resolveStateRoot helper in state.ts. Was previously
  // duplicated here + in researcherHistoryHeuristic + in preventions.ts.
  const root = resolveStateRoot(stateRoot)
  const keywords = extractKeywords(intentDraft)
  const scans = await walkSolutionsCorpus(root, keywords)

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

// CE-1.1 (DRY): exported so preventions.ts can share the same tokenization
// path (NFC + Intl.Segmenter via dedup.ts:tokenize) instead of inlining
// `Array.from(tokenize(...))`. Single source of truth across dedup.ts,
// researcher-history.ts, preventions.ts.
export function extractKeywords(text: string): string[] {
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

async function mineSolutions(
  stateRoot: string,
  keywords: string[],
): Promise<PriorArt[]> {
  const scans = await walkSolutionsCorpus(stateRoot, keywords)
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

export async function researcherHistoryHeuristic(
  input: ResearcherHistoryInput,
  opts: ResearcherHistoryOptions = {},
): Promise<ResearcherHistoryOutput> {
  // CE-1.1 L1.b: lifted to resolveStateRoot helper in state.ts.
  const stateRoot = resolveStateRoot(opts.stateRoot)
  const keywords = extractKeywords(input.intent_draft ?? "")

  const prior_art = await mineSolutions(stateRoot, keywords)
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
 * Structural validation (6 guards) is delegated to
 * `composeArrayObjectValidator` in ../validation.ts (P2 #8). This function
 * builds the per-call shape (refSet/candByRef vary by candidates) and maps
 * validated raw entries into typed `PriorArt[]` with two transforms the DSL
 * deliberately leaves to the caller:
 *
 *   - back-fill `excerpt` + `source` from the candidates map so the LLM
 *     doesn't have to re-emit ~500-char strings (saves output tokens; defense
 *     against the LLM mangling the excerpt).
 *   - relevance_reason whitespace fold + markdown escape (T6 review I-2 +
 *     H.1 #9). Renders as a markdown bullet in intent.md; meta chars (`*_`[]`)
 *     would otherwise trigger emphasis / code-span / link parsing.
 *
 * 6 guards encoded in the DSL shape:
 *   1. prior_art is array                          → DSL outer check
 *   2. each entry's solution_ref ∈ candidates set  → field: string-in-set
 *   3. relevance_score ∈ [0, 1]; tightened to [0.3, 1] when relevance_reason
 *      present (LLM mode)                          → field: finite-number-range + validateEntry
 *   4. relevance_reason non-empty when present     → field: optional-non-empty-string
 *   5. truncate prior_art > 5 to first 5 unique    → maxLength: 5
 *   6. duplicate solution_ref first-wins + warning → dedupBy: "solution_ref"
 */
export function coerceLlmOutput(
  raw: unknown,
  candidates: PriorArtCandidate[],
): ResearcherHistoryOutput {
  const refSet = new Set(candidates.map((c) => c.solution_ref))
  const candByRef = new Map(candidates.map((c) => [c.solution_ref, c]))

  const validate = composeArrayObjectValidator({
    agentName: "researcher.history",
    topField: "prior_art",
    fields: {
      solution_ref: { kind: "string-in-set", set: refSet },
      relevance_score: { kind: "finite-number-range", min: 0, max: 1 },
      relevance_reason: { kind: "optional-non-empty-string" },
    },
    validateEntry: (entry) => {
      // Guard 3 LLM-mode tightening: when relevance_reason is present
      // (LLM mode), score must be ≥ 0.3. Heuristic mode omits the field
      // entirely so this cross-field rule doesn't fire.
      if (entry["relevance_reason"] !== undefined && (entry["relevance_score"] as number) < 0.3) {
        return `relevance_score must be ≥ 0.3 in LLM mode (with relevance_reason), got ${entry["relevance_score"]}`
      }
      return null
    },
    dedupBy: "solution_ref",
    maxLength: 5,
  })

  const { entries, warnings } = validate(raw)

  const prior_art: PriorArt[] = entries.map((entry) => {
    const ref = entry["solution_ref"] as string
    const score = entry["relevance_score"] as number
    const reason = entry["relevance_reason"] as string | undefined
    const cand = candByRef.get(ref)!
    const out: PriorArt = {
      source: "solutions",
      solution_ref: ref,
      relevance_score: score,
      excerpt: cand.excerpt,
    }
    if (reason !== undefined) {
      // ZWSP strip + whitespace fold (incl. U+0085 NEL via the bracket-class
      // line below) + markdown meta-char escape — renders as a markdown
      // bullet in intent.md (T6 review I-2 + H.1 #9).
      out.relevance_reason = reason
        .replace(/​/g, "")
        .replace(/[\s]+/g, " ")
        .trim()
        .replace(/([*_`[\]])/g, "\\$1")
    }
    return out
  })

  return { prior_art, warnings }
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
