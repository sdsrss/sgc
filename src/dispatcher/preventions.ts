// CE-1 (task 94913CB45F9D4C3E906B3C2C8E#f2): extract prior-prevention
// text from solutions/<category>/*.md and surface as planner.adversarial
// input.
//
// Reuses walkSolutionsCorpus (NFC + Intl.Segmenter tokenization, already
// proven on the researcher.history path). Reads the optional `prevention`
// frontmatter field via parseFrontmatter; files missing the field, or
// carrying an empty/whitespace-only value, are silently skipped —
// defensive against the legacy on-disk shape (frontmatter `intent` +
// `category` only, no compound-written prevention).
//
// Scope contract: planner.adversarial's declared scope_tokens still
// do NOT include read:solutions. The data crosses the boundary as a
// spawn input field pre-fetched by /plan (which holds the scope).

import { parseFrontmatter } from "./state"
import { walkSolutionsCorpus } from "./agents/researcher-history"
import { tokenize } from "./dedup"
import type { SolutionCategory } from "./types"

export interface PriorPrevention {
  solution_ref: string
  category: SolutionCategory
  prevention_text: string
}

export interface ExtractPreventionsOptions {
  topN?: number
  maxCharsPerText?: number
}

const DEFAULT_TOP_N = 3
const DEFAULT_MAX_CHARS = 240

/**
 * Word-boundary-aware truncation with "..." sentinel (RT-2 repair).
 *
 * Pre-fix the extractor hard-cut at `maxChars` regardless of word boundary,
 * which on the 487-char vendor-word seed cut at "state-dir collisio" — the
 * LLM saw an enumeration of failure modes without the corrective half
 * ("use implement/absorb/adopt + 'not doing' clause"), inverting CE-1's
 * intent. Now: cut at the last whitespace within `maxChars - 3` (room for
 * "..."), fall back to hard cut only if no whitespace within the bottom
 * half (ultra-long unbreakable token).
 */
function truncateOnWordBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  const limit = maxChars - 3 // reserve room for "..."
  const lastSpace = text.lastIndexOf(" ", limit)
  const cutAt =
    lastSpace > Math.floor(limit / 2) ? lastSpace : limit
  return text.slice(0, cutAt).trimEnd() + "..."
}

export async function extractPreventions(
  intentDraft: string,
  stateRoot?: string,
  opts: ExtractPreventionsOptions = {},
): Promise<PriorPrevention[]> {
  const root = stateRoot ?? process.env["SGC_STATE_ROOT"] ?? ".sgc"
  const topN = opts.topN ?? DEFAULT_TOP_N
  const maxChars = opts.maxCharsPerText ?? DEFAULT_MAX_CHARS

  const keywords = Array.from(tokenize(intentDraft ?? ""))
  if (keywords.length === 0) return []

  const scans = await walkSolutionsCorpus(root, keywords)

  type Scored = { scan: (typeof scans)[number]; text: string }
  const scored: Scored[] = []
  for (const scan of scans) {
    let parsed: { data: Record<string, unknown> }
    try {
      parsed = parseFrontmatter<Record<string, unknown>>(scan.text)
    } catch {
      // Defensive: solutions/ may contain test fixtures or legacy files
      // with no frontmatter fence (e.g. raw markdown blobs). Skip silently —
      // preFilterSolutions tolerates the same shape on its own path.
      continue
    }
    const raw = parsed.data["prevention"]
    if (typeof raw !== "string") continue
    const folded = raw.replace(/\s+/g, " ").trim()
    if (folded.length === 0) continue
    scored.push({ scan, text: truncateOnWordBoundary(folded, maxChars) })
  }

  scored.sort((a, b) => b.scan.hits - a.scan.hits)

  return scored.slice(0, topN).map((s) => ({
    solution_ref: `${s.scan.category}/${s.scan.slug}`,
    category: s.scan.category,
    prevention_text: s.text,
  }))
}
