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
  return text.toLowerCase().trim().replace(/\s+/g, " ")
}

const STOPWORDS = new Set([
  "the", "a", "an", "is", "of", "in", "to", "for", "and", "or", "on", "with",
  "this", "that", "we", "as", "by", "at", "from", "be", "it", "are", "have",
  "was", "not", "has", "but", "they", "you", "our", "its", "can", "will", "it's",
])

export function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  return new Set(tokens)
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let intersect = 0
  for (const t of a) if (b.has(t)) intersect++
  const union = a.size + b.size - intersect
  if (union === 0) return 0
  return intersect / union
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
  const tagScore = jaccard(new Set(candidate.tags), new Set(existing.tags))
  const probScore = jaccard(tokenize(candidate.problem), tokenize(existing.problem))
  return (tagScore + probScore) / 2
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
