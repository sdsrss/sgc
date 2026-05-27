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

export type DebugPhase =
  | "investigate"
  | "analyze"
  | "hypothesize"
  | "implement"
  | "closed"

export type DebugStatus = "in_progress" | "closed"

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
