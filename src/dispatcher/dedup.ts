// Similarity + dedup for solutions/.
//
// Per Invariant §3, solutions writes must pass dedup. The spec says:
//   - exact signature match (weight: 1.0)
//   - fallback: cosine similarity over tag_vector + problem embedding
//   - threshold: 0.85 (NOT user-tunable)
//
// D-dec-2: we use Jaccard instead of cosine in the fallback for D-phase
// (no embedding dependency). Swap to cosine+embeddings later without
// breaking the public API.

import { createHash } from "node:crypto"
import type { SolutionFile } from "./state"

/** Invariant §3 threshold — hardcoded, not a runtime knob. */
export const DEDUP_THRESHOLD = 0.85

/**
 * Canonical signature for a problem + error fingerprint.
 * Primary dedup key — two entries with the same signature MUST merge.
 */
export function computeSignature(problem: string, errorFingerprint?: string): string {
  const normalized = normalizeText(`${problem}\n${errorFingerprint ?? ""}`)
  return createHash("sha256").update(normalized).digest("hex")
}

export function normalizeText(text: string): string {
  // NFC normalization so NFD (decomposed, e.g. "e + U+0301") and NFC
  // (precomposed, e.g. "U+00E9") produce identical signatures. Required
  // for stable dedup across OS / paste sources.
  return text.normalize("NFC").toLowerCase().trim().replace(/\s+/g, " ")
}

const STOPWORDS = new Set([
  "the", "a", "an", "is", "of", "in", "to", "for", "and", "or", "on", "with",
  "this", "that", "we", "as", "by", "at", "from", "be", "it", "are", "have",
  "was", "not", "has", "but", "they", "you", "our", "its", "can", "will", "it's",
])

// ICU-backed word segmentation. Empty locale list lets ICU pick based on input;
// handles EN / CJK / Thai / Arabic uniformly. Pre-hotfix tokenize used
// `split(/[^a-z0-9]+/)` which zeroed out all non-ASCII text.
const SEGMENTER = new Intl.Segmenter([], { granularity: "word" })

export function tokenize(text: string): Set<string> {
  // GS-1.2 live-dogfood fix (v1.12.1, 2026-05-25): operator-local
  // `.sgc/solutions/*.md` corpora may carry legacy hand-written entries
  // missing schema-required fields (e.g. only `intent:` + `category:`
  // frontmatter from pre-CE-1 phases). When findBestMatch iterates such
  // entries, `tokenize(existing.problem)` receives undefined and crashes
  // at `.normalize()`. Coerce non-string input to an empty Set so
  // similarity() degrades to "no overlap" rather than throwing — keeps
  // the entire compound/promote pipeline operational against partially
  // malformed corpora. Caught by GS-1.1 live promote dogfood of
  // .sgc/canaries/2026-05-25-c29f021-smoke_install.md against the
  // local solutions/ corpus (2 of 3 entries are legacy minimal-frontmatter).
  if (typeof text !== "string" || text.length === 0) return new Set()
  const normalized = text.normalize("NFC").toLowerCase()
  const tokens = new Set<string>()
  for (const seg of SEGMENTER.segment(normalized)) {
    if (!seg.isWordLike) continue // filter punctuation / whitespace
    const w = seg.segment
    // Script-aware length floor: ASCII words need 3+ chars (pre-hotfix rule —
    // English content words are long, "the"/"is"/"of" are stopwords or short).
    // CJK / other scripts need 2+ chars (Chinese content words are naturally
    // 2-char: 修复, 指针, 认证; single-char segments like 的, 时 are mostly
    // grammatical particles, drop as noise).
    // ALG-3 (P2 audit) re-evaluated this floor: minLen=2 also drops single-char
    // *content* words (锁, 树). That is the accepted trade-off — lowering to 1
    // would readmit high-frequency particles (的/了/在/是) that dilute the
    // Jaccard signal far more than a rare single-char content word helps, and
    // similarity() feeds the non-tunable 0.85 §3 write gate. Accepted range.
    const isAsciiOnly = /^[\x00-\x7F]+$/.test(w)
    const minLen = isAsciiOnly ? 3 : 2
    if (w.length < minLen) continue
    if (STOPWORDS.has(w)) continue
    tokens.add(w)
  }
  return tokens
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let intersect = 0
  for (const t of a) if (b.has(t)) intersect++
  const union = a.size + b.size - intersect
  if (union === 0) return 0
  return intersect / union
}

/**
 * Similarity of two feature sets that returns 0 — not 1 — for the empty/empty
 * case (ALG-1). `jaccard` keeps the mathematical identity convention J(∅,∅)=1,
 * but when a feature carries NO tokens on either side it provides no evidence
 * of similarity; treating that as a perfect match falsely merges
 * information-free entries (dedup write-gate) and unrelated concern keys
 * (fuse-plan). Non-empty inputs delegate to `jaccard` unchanged.
 */
export function featureOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  return jaccard(a, b)
}

export interface SimilarityCandidate {
  signature: string
  tags: string[]
  problem: string
}

/**
 * Similarity score in [0, 1].
 *   - exact signature match → 1.0
 *   - else → average(jaccard(tags), jaccard(problem_tokens))
 */
export function similarity(
  candidate: SimilarityCandidate,
  existing: SimilarityCandidate,
): number {
  if (candidate.signature && candidate.signature === existing.signature) return 1
  // GS-1.2 live-dogfood fix: defensive against legacy corpus entries
  // missing the `tags:` field (TypeScript declares string[]; runtime
  // shape from minimal-frontmatter files yields undefined). tokenize()
  // already coerces undefined → empty Set for the `problem` field; do
  // the same shape for tags here.
  const candTags = Array.isArray(candidate.tags) ? candidate.tags : []
  const exTags = Array.isArray(existing.tags) ? existing.tags : []
  const candTagSet = new Set(candTags)
  const exTagSet = new Set(exTags)
  const candProb = tokenize(candidate.problem)
  const exProb = tokenize(existing.problem)

  // ALG-1 (audit fix): average only the feature components that carry a signal
  // (at least one side non-empty). A component empty on BOTH sides is no
  // evidence — including it as jaccard(∅,∅)=1 inflated the score and falsely
  // deduped information-free entries; excluding it (rather than scoring it 0)
  // avoids the inverse error of dragging a real tagless-but-identical-problem
  // duplicate below threshold. All-empty candidate → no components → 0.
  const components: number[] = []
  if (candTagSet.size > 0 || exTagSet.size > 0) components.push(jaccard(candTagSet, exTagSet))
  if (candProb.size > 0 || exProb.size > 0) components.push(jaccard(candProb, exProb))
  if (components.length === 0) return 0
  return components.reduce((sum, c) => sum + c, 0) / components.length
}

export interface BestMatch {
  match: SolutionFile
  similarity: number
}

/** Highest-scoring existing entry (or null when `existing` is empty). */
export function findBestMatch(
  candidate: SimilarityCandidate,
  existing: SolutionFile[],
): BestMatch | null {
  let best: BestMatch | null = null
  for (const s of existing) {
    const sim = similarity(candidate, {
      signature: s.entry.signature,
      tags: s.entry.tags,
      problem: s.entry.problem,
    })
    if (!best || sim > best.similarity) {
      best = { match: s, similarity: sim }
    }
  }
  return best
}

/** True if we should treat `candidate` as a duplicate of an existing entry. */
export function isDuplicate(best: BestMatch | null): boolean {
  if (!best) return false
  return best.similarity >= DEDUP_THRESHOLD
}
