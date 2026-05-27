// `sgc debug` — 4-phase systematic-debugging walker.
//
// GS-4 (f11) feature. New .sgc/investigations/<id>.md single-file state
// per record. Auto-walks investigate + analyze + hypothesize on `start`,
// pauses at implement. `close` is the Iron Law #3 hard-gate: refuses
// unless --root-cause + --fix-commit + --verify-command all non-empty.
//
// Heuristic-only. No LLM. No agent spawn. No Invariant §1/§3/§6/§13
// paired event owed; four voluntary debug.* events are additive
// telemetry on events.ndjson.

import type { Logger } from "./logger"
import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { walkSolutionsCorpus, extractKeywords } from "./agents/researcher-history"
import type { SolutionScan } from "./agents/researcher-history"
import { parseFrontmatter } from "./state"

export type DebugPhase =
  | "investigate"
  | "analyze"
  | "hypothesize"
  | "implement"
  | "closed"

export type DebugStatus = "in_progress" | "closed"

/**
 * Invariant (writer responsibility, not type-enforced):
 * `status === "closed"` MUST coexist with `current_phase === "closed"`.
 * Set both atomically in `runDebugClose` after Iron Law #3 gate passes.
 */
export interface InvestigationFrontmatter {
  id: string
  status: DebugStatus
  current_phase: DebugPhase
  symptom: string
  started_at: string
  closed_at: string | null
  root_cause: string | null
  fix_commit: string | null
  verify_command: string | null
}

export interface InvestigateFacts {
  git_head?: string
  git_status_paths: string[]
  recent_events: Array<{ ts: string; event_type: string; agent: string }>
  errors: string[]
}

export interface CorpusHit {
  solution_ref: string
  prevention_excerpt: string
  overlap_score: number
}

export interface HistoricalSignatureHit {
  kind: "ship-failure" | "canary"
  slug: string
  excerpt: string
}

export interface ThreeStrikeHit {
  signature: string
  count: number
  example_ts: string
}

export interface AnalyzeOutput {
  prior_preventions: CorpusHit[]
  historical_signatures: HistoricalSignatureHit[]
  three_strike: ThreeStrikeHit[]
  errors: string[]
}

export interface HeuristicReaders {
  gatherInvestigateFacts: (opts: {
    stateRoot: string
    repoRoot: string
  }) => Promise<InvestigateFacts>
  analyzeCorpus: (opts: {
    stateRoot: string
    symptom: string
  }) => Promise<CorpusHit[]>
  detectThreeStrike: (opts: {
    stateRoot: string
  }) => Promise<ThreeStrikeHit[]>
  scanHistoricalSignatures: (opts: {
    stateRoot: string
    symptom: string
  }) => Promise<HistoricalSignatureHit[]>
}

export interface DebugStartOptions {
  symptom: string
  stateRoot?: string
  repoRoot?: string
  logger?: Logger
  heuristic?: HeuristicReaders
  now?: () => Date
  stdoutWrite?: (chunk: string) => void
  stderrWrite?: (chunk: string) => void
}

export interface DebugCloseOptions {
  id: string
  rootCause: string
  fixCommit: string
  verifyCommand: string
  stateRoot?: string
  logger?: Logger
  now?: () => Date
  stdoutWrite?: (chunk: string) => void
  stderrWrite?: (chunk: string) => void
}

export interface DebugListOptions {
  stateRoot?: string
  stdoutWrite?: (chunk: string) => void
}

export interface DebugStatusOptions {
  id: string
  stateRoot?: string
  stdoutWrite?: (chunk: string) => void
  stderrWrite?: (chunk: string) => void
}

export interface DebugResult {
  exitCode: 0 | 1
}

// Exported for unit testing.
export function deriveInvestigationId(symptom: string, now: Date): string {
  const yyyy = now.getUTCFullYear().toString().padStart(4, "0")
  const mm = (now.getUTCMonth() + 1).toString().padStart(2, "0")
  const dd = now.getUTCDate().toString().padStart(2, "0")
  const hh = now.getUTCHours().toString().padStart(2, "0")
  const min = now.getUTCMinutes().toString().padStart(2, "0")
  const prefix = `${yyyy}-${mm}-${dd}-${hh}${min}`

  const kebab = symptom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  if (kebab.length === 0) return `${prefix}-debug`

  const truncated = kebab.slice(0, 30).replace(/-+$/, "")
  return `${prefix}-${truncated}`
}

async function readEventsTail(
  stateRoot: string,
  lineLimit: number,
): Promise<{ lines: string[]; error?: string }> {
  const path = join(stateRoot, "progress", "events.ndjson")
  try {
    const content = await readFile(path, "utf8")
    const all = content.split("\n").filter((l) => l.length > 0)
    return { lines: all.slice(-lineLimit) }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === "ENOENT") return { lines: [], error: "events_tail: file missing" }
    return {
      lines: [],
      error: `events_tail: ${(err as Error).message.slice(0, 80)}`,
    }
  }
}

async function gatherInvestigateFactsImpl(opts: {
  stateRoot: string
  repoRoot: string
}): Promise<InvestigateFacts> {
  const errors: string[] = []
  const facts: InvestigateFacts = {
    git_status_paths: [],
    recent_events: [],
    errors,
  }

  // git head
  try {
    const r = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: opts.repoRoot,
      encoding: "utf8",
    })
    if (r.error) errors.push(`git_head: ${r.error.message.slice(0, 80)}`)
    else if (r.status === 0) facts.git_head = r.stdout.trim()
    else errors.push(`git_head: ${(r.stderr || "non-zero exit").trim().slice(0, 80)}`)
  } catch (err) {
    errors.push(`git_head: ${(err as Error).message.slice(0, 80)}`)
  }

  // git status (first 20 paths)
  try {
    const r = spawnSync("git", ["status", "--porcelain=v1"], {
      cwd: opts.repoRoot,
      encoding: "utf8",
    })
    if (r.error) errors.push(`git_status: ${r.error.message.slice(0, 80)}`)
    else if (r.status === 0) {
      facts.git_status_paths = r.stdout
        .split(/\r?\n/)
        .filter((l) => l.length > 0)
        .slice(0, 20)
    } else {
      errors.push(`git_status: ${(r.stderr || "non-zero exit").trim().slice(0, 80)}`)
    }
  } catch (err) {
    errors.push(`git_status: ${(err as Error).message.slice(0, 80)}`)
  }

  // events tail (last 50 lines for investigate; analyze uses 500)
  const tail = await readEventsTail(opts.stateRoot, 50)
  if (tail.error) errors.push(tail.error)
  for (const line of tail.lines) {
    try {
      const e = JSON.parse(line)
      facts.recent_events.push({
        ts: String(e.ts ?? ""),
        event_type: String(e.event_type ?? ""),
        agent: String(e.agent ?? ""),
      })
    } catch {
      // skip malformed line silently — line-level parse errors do not
      // propagate to errors[]; debug.heuristic_failed fires only on
      // reader-level promise rejection at the T7 orchestrator boundary
    }
  }

  return facts
}

async function analyzeCorpusImpl(opts: {
  stateRoot: string
  symptom: string
}): Promise<CorpusHit[]> {
  const keywords = extractKeywords(opts.symptom)
  if (keywords.length === 0) return []

  let scans: SolutionScan[]
  try {
    scans = await walkSolutionsCorpus(opts.stateRoot, keywords)
  } catch {
    return []
  }

  const hits: CorpusHit[] = []
  for (const scan of scans) {
    let prevention: string
    try {
      const fm = parseFrontmatter<{ prevention?: string }>(scan.text)
      prevention = (fm.data.prevention ?? "").trim()
    } catch {
      continue
    }
    if (prevention.length === 0) continue

    hits.push({
      solution_ref: `${scan.category}/${scan.slug}.md`,
      prevention_excerpt: prevention.slice(0, 240),
      overlap_score: scan.hits,
    })
  }

  hits.sort((a, b) => b.overlap_score - a.overlap_score)
  return hits.slice(0, 5)
}

async function detectThreeStrikeImpl(opts: {
  stateRoot: string
}): Promise<ThreeStrikeHit[]> {
  const tail = await readEventsTail(opts.stateRoot, 500)
  if (tail.lines.length === 0) return []

  const counts = new Map<string, { count: number; first_ts: string }>()
  for (const line of tail.lines) {
    let e: { ts?: string; payload?: { error_class?: string; error_message?: string } }
    try {
      e = JSON.parse(line)
    } catch {
      continue
    }
    const cls = e.payload?.error_class
    const msg = e.payload?.error_message
    if (!cls || !msg) continue
    const sig = `${cls}: ${msg.slice(0, 80)}`
    const cur = counts.get(sig)
    if (cur) cur.count++
    else counts.set(sig, { count: 1, first_ts: String(e.ts ?? "") })
  }

  const strikes: ThreeStrikeHit[] = []
  for (const [signature, { count, first_ts }] of counts) {
    if (count >= 3) strikes.push({ signature, count, example_ts: first_ts })
  }
  strikes.sort((a, b) => b.count - a.count)
  return strikes
}

async function scanDir(
  stateRoot: string,
  dir: "ship-failures" | "canaries",
  needle: string,
): Promise<HistoricalSignatureHit[]> {
  const path = join(stateRoot, dir)
  let entries: string[]
  try {
    entries = await readdir(path)
  } catch {
    return []
  }
  const hits: HistoricalSignatureHit[] = []
  for (const name of entries) {
    if (!name.endsWith(".md")) continue
    let content: string
    try {
      content = await readFile(join(path, name), "utf8")
    } catch {
      continue
    }
    const contentLower = content.toLowerCase()
    const needleLower = needle.toLowerCase()
    const idx = contentLower.indexOf(needleLower)
    if (idx < 0) continue
    const excerptStart = Math.max(0, idx - 30)
    const excerpt = content
      .slice(excerptStart, excerptStart + 160)
      .replace(/\s+/g, " ")
      .trim()
    hits.push({
      kind: dir === "ship-failures" ? "ship-failure" : "canary",
      slug: name.replace(/\.md$/, ""),
      excerpt,
    })
  }
  return hits
}

async function scanHistoricalSignaturesImpl(opts: {
  stateRoot: string
  symptom: string
}): Promise<HistoricalSignatureHit[]> {
  const needle = opts.symptom.slice(0, 80).trim()
  if (needle.length === 0) return []
  const [shipHits, canaryHits] = await Promise.all([
    scanDir(opts.stateRoot, "ship-failures", needle),
    scanDir(opts.stateRoot, "canaries", needle),
  ])
  return [...shipHits, ...canaryHits]
}

export function defaultHeuristic(): HeuristicReaders {
  return {
    gatherInvestigateFacts: gatherInvestigateFactsImpl,
    analyzeCorpus: analyzeCorpusImpl,
    detectThreeStrike: detectThreeStrikeImpl,
    scanHistoricalSignatures: scanHistoricalSignaturesImpl,
  }
}
