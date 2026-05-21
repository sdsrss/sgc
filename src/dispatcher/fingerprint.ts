// Post-LLM-response Invariant §1 leak detection.
//
// The input-side spawn.ts:checkInvariantOneBackChannel + scope_token denial
// + manifest forbidden_for stop *deliberate* exfiltration of solutions/
// content into reviewer.* / qa.* inputs. But §1 + §8 are documented as
// "advisory for real-LLM modes" — an LLM running under claude-cli or any
// backend with shell-tool access can `cat .sgc/solutions/*.md` itself and
// quote what it finds in its output. README.md acknowledges this gap;
// this module closes it for the lazy-copy/literal-quote class of leak.
//
// Design — fingerprint-then-scan:
//   1. Walk `<stateRoot>/solutions/<cat>/<slug>.md`, hash every fingerprint-
//      able line (>= MIN_LINE_LEN chars, not pure markdown structure).
//   2. After spawn collects agent output, recursively walk string-typed
//      values. Apply the same hash rule and check against the set. Any
//      hit = leak.
//   3. Only reviewer.* / qa.* are gated. compound.*, researcher.history,
//      planner.* legitimately quote solutions and are exempt.
//
// Trade-offs:
//   - Line-level hashing tolerates whitespace/case normalization but not
//     paraphrasing. A "smart" LLM that summarizes solutions content in
//     novel words bypasses this gate — accepted limitation; the gate is
//     against accidental copy-paste, not adversarial paraphrase. v2 could
//     use n-gram overlap or embedding similarity (~10x cost, lower FP).
//   - One per-process cache keyed by stateRoot. solutions/ is only written
//     by compound after ship — within a single CLI invocation the set is
//     stable. Tests can call clearFingerprintCache() between fixtures.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import { createHash } from "node:crypto"

const MIN_LINE_LEN = 25
const HASH_LEN = 16

export type Fingerprints = Set<string>

function isFingerprintable(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length < MIN_LINE_LEN) return false
  const c = trimmed[0]
  // Pure markdown structure / frontmatter delimiter.
  if (c === "#" || c === "-" || c === "*" || c === ">" || c === "|" || c === "`") return false
  if (trimmed === "---" || trimmed === "...") return false
  return true
}

function hashLine(line: string): string {
  // Normalize: lowercase + collapse whitespace, so lines with cosmetic
  // diffs still collide.
  const norm = line.trim().toLowerCase().replace(/\s+/g, " ")
  return createHash("sha256").update(norm).digest("hex").slice(0, HASH_LEN)
}

function safeReaddir(dir: string): string[] {
  try { return readdirSync(dir) } catch { return [] }
}
function isDir(path: string): boolean {
  try { return statSync(path).isDirectory() } catch { return false }
}
function safeReadFile(path: string): string | null {
  try { return readFileSync(path, "utf8") } catch { return null }
}

/**
 * Walk `<stateRoot>/solutions/` and hash all fingerprintable lines.
 * Tolerates missing dir / unreadable files (returns whatever was readable).
 */
export function loadSolutionsFingerprints(stateRoot: string): Fingerprints {
  const dir = resolve(stateRoot, "solutions")
  const set: Fingerprints = new Set()
  if (!existsSync(dir)) return set
  for (const cat of safeReaddir(dir)) {
    const catPath = join(dir, cat)
    if (!isDir(catPath)) continue
    for (const file of safeReaddir(catPath)) {
      if (!file.endsWith(".md")) continue
      const text = safeReadFile(join(catPath, file))
      if (!text) continue
      for (const line of text.split("\n")) {
        if (!isFingerprintable(line)) continue
        set.add(hashLine(line))
      }
    }
  }
  return set
}

const fpCache = new Map<string, Fingerprints>()

export function getFingerprintsCached(stateRoot: string): Fingerprints {
  const key = resolve(stateRoot)
  let v = fpCache.get(key)
  if (!v) {
    v = loadSolutionsFingerprints(key)
    fpCache.set(key, v)
  }
  return v
}

export function clearFingerprintCache(): void {
  fpCache.clear()
}

function isReviewerOrQaAgent(name: string): boolean {
  return name.startsWith("reviewer.") || name.startsWith("qa.")
}

export interface LeakReport {
  hit: boolean
  /** First few matched line excerpts (≤ 100 chars each), for error reporting. */
  samples: string[]
  /** Total number of distinct matching lines. */
  count: number
}

/**
 * Scan `output` for fingerprintable lines that collide with solutions/.
 * Non-reviewer/qa agents and empty fingerprint sets short-circuit clean.
 */
export function scanOutputForLeak(
  agentName: string,
  output: unknown,
  fingerprints: Fingerprints,
): LeakReport {
  if (!isReviewerOrQaAgent(agentName) || fingerprints.size === 0) {
    return { hit: false, samples: [], count: 0 }
  }
  const samples: string[] = []
  let count = 0
  const seen = new Set<string>()
  function walk(v: unknown): void {
    if (typeof v === "string") {
      for (const line of v.split("\n")) {
        if (!isFingerprintable(line)) continue
        const h = hashLine(line)
        if (fingerprints.has(h) && !seen.has(h)) {
          seen.add(h)
          count++
          if (samples.length < 3) {
            const trimmed = line.trim()
            samples.push(trimmed.length > 100 ? trimmed.slice(0, 97) + "..." : trimmed)
          }
        }
      }
    } else if (Array.isArray(v)) {
      for (const item of v) walk(item)
    } else if (v && typeof v === "object") {
      for (const val of Object.values(v)) walk(val)
    }
  }
  walk(output)
  return { hit: count > 0, samples, count }
}
