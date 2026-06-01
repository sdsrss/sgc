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
//
// CE-1.1 hardening additions:
//   L1.a — extractKeywords lifted from researcher-history.ts (DRY).
//   L1.b — resolveStateRoot lifted to state.ts (DRY across 3 sites).
//   L1.c — RT-5 cap clamps on opts.topN and opts.maxCharsPerText to
//          prevent caller-side prompt-budget bypass (e.g. topN: 9999).
//   L1.d — opts.logger + opts.taskId; on every skip-reason a Tier-2
//          `prevention.skipped` event surfaces via sgc tail so operators
//          can see why a corpus match did not produce an emission.

import { extractKeywords, walkSolutionsCorpus } from "./agents/researcher-history"
import type { Logger } from "./logger"
import { parseFrontmatter, resolveStateRoot } from "./state"
import type { SolutionCategory } from "./types"

export interface PriorPrevention {
  solution_ref: string
  category: SolutionCategory
  prevention_text: string
}

export interface ExtractPreventionsOptions {
  topN?: number
  maxCharsPerText?: number
  /** CE-1.1 L1.d: when provided, Tier-2 prevention.skipped events fire on
   *  parse/missing/empty/oversize skips so operators see drop reasons. */
  logger?: Logger
  /** CE-1.1 L1.d: paired with `logger`; surfaces task_id on the audit event. */
  taskId?: string | null
}

const DEFAULT_TOP_N = 3
const DEFAULT_MAX_CHARS = 240

// CE-1.1 L1.c (RT-5): cap clamps. Caller-side `topN: 9999` previously
// returned the full keyword-matched corpus, bloating the planner.adversarial
// input past prompt budgets. Defensive max chosen so a malicious / buggy
// caller cannot exceed ≈10 KB of prevention text in the planner spawn
// (10 entries × 1000 chars).
const MIN_TOP_N = 1
const MAX_TOP_N = 10
const MIN_MAX_CHARS = 40
const MAX_MAX_CHARS = 1000

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

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

// CE-2 (audit fix): structural prompt-injection break-out vectors. The
// prevention text is LLM-authored corpus content (compound.prevention), and
// compound.* output is intentionally NOT leak-scanned (it is allowed to read
// solutions). extractPreventions is therefore the trust boundary where corpus
// content crosses back INTO the planner.adversarial prompt. Neutralize the
// delimiters that could let the data break out of its framing — chat-role
// tags, model special tokens, llama [INST] markers, NUL. Content-level prose
// is deliberately preserved: legitimate preventions document injection lessons
// themselves, so redacting phrases like "ignore previous instructions" would
// corrupt real knowledge. The prompt template frames this as data; this strips
// the structural escapes a payload would use to leave that frame.
const INJECTION_PATTERNS: readonly RegExp[] = [
  /<\|[^|]*\|>/g, // <|im_start|>, <|endoftext|>, etc.
  /<\/?\s*(?:system|assistant|user|tool|instructions?)\s*>/gi, // chat-role XML tags
  /\[\/?\s*INST\s*\]/gi, // llama [INST] / [/INST]
  /\u0000/g, // NUL byte
]

/**
 * Neutralize structural prompt-injection break-out tokens in corpus text
 * before it is re-injected into a prompt (CE-2). Returns the cleaned text with
 * whitespace re-folded. Pure — no IO, no logging.
 */
export function sanitizePreventionText(text: string): string {
  let out = text
  for (const re of INJECTION_PATTERNS) out = out.replace(re, " ")
  return out.replace(/\s+/g, " ").trim()
}

type SkipReason =
  | "frontmatter_parse_failed"
  | "prevention_field_missing"
  | "prevention_field_empty"

function emitSkip(
  logger: Logger | undefined,
  taskId: string | null | undefined,
  solutionRef: string,
  reason: SkipReason,
): void {
  if (!logger) return
  logger.event({
    task_id: taskId ?? null,
    spawn_id: null,
    agent: "plan.preventions",
    event_type: "prevention.skipped",
    level: "warn",
    payload: { solution_ref: solutionRef, reason },
  })
}

export async function extractPreventions(
  intentDraft: string,
  stateRoot?: string,
  opts: ExtractPreventionsOptions = {},
): Promise<PriorPrevention[]> {
  const root = resolveStateRoot(stateRoot)
  const topN = clamp(opts.topN ?? DEFAULT_TOP_N, MIN_TOP_N, MAX_TOP_N)
  const maxChars = clamp(
    opts.maxCharsPerText ?? DEFAULT_MAX_CHARS,
    MIN_MAX_CHARS,
    MAX_MAX_CHARS,
  )

  const keywords = extractKeywords(intentDraft ?? "")
  if (keywords.length === 0) return []

  const scans = await walkSolutionsCorpus(root, keywords)

  type Scored = { scan: (typeof scans)[number]; text: string }
  const scored: Scored[] = []
  for (const scan of scans) {
    const solutionRef = `${scan.category}/${scan.slug}`
    let parsed: { data: Record<string, unknown> }
    try {
      parsed = parseFrontmatter<Record<string, unknown>>(scan.text)
    } catch {
      // Defensive: solutions/ may contain test fixtures or legacy files
      // with no frontmatter fence (e.g. raw markdown blobs). Skip silently —
      // preFilterSolutions tolerates the same shape on its own path.
      emitSkip(opts.logger, opts.taskId, solutionRef, "frontmatter_parse_failed")
      continue
    }
    const raw = parsed.data["prevention"]
    if (typeof raw !== "string") {
      emitSkip(opts.logger, opts.taskId, solutionRef, "prevention_field_missing")
      continue
    }
    const folded = raw.replace(/\s+/g, " ").trim()
    if (folded.length === 0) {
      emitSkip(opts.logger, opts.taskId, solutionRef, "prevention_field_empty")
      continue
    }
    // CE-2: neutralize structural prompt-injection vectors before this
    // corpus text re-enters the planner.adversarial prompt.
    const sanitized = sanitizePreventionText(folded)
    if (sanitized !== folded) {
      opts.logger?.event({
        task_id: opts.taskId ?? null,
        spawn_id: null,
        agent: "plan.preventions",
        event_type: "prevention.sanitized",
        level: "warn",
        payload: { solution_ref: solutionRef, removed_chars: folded.length - sanitized.length },
      })
    }
    if (sanitized.length === 0) {
      emitSkip(opts.logger, opts.taskId, solutionRef, "prevention_field_empty")
      continue
    }
    scored.push({ scan, text: truncateOnWordBoundary(sanitized, maxChars) })
  }

  scored.sort((a, b) => b.scan.hits - a.scan.hits)

  return scored.slice(0, topN).map((s) => ({
    solution_ref: `${s.scan.category}/${s.scan.slug}`,
    category: s.scan.category,
    prevention_text: s.text,
  }))
}
