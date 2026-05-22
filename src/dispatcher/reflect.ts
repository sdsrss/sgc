// CE-2 (f3): `sgc reflect` decisions↔solutions audit.
//
// Pure-logic module — no I/O wiring, no CLI flag parsing. The CLI run
// handler at src/commands/reflect.ts owns argument shaping; this module
// owns the audit pipeline + formatter.
//
// Spec: tasks/specs/ce-2-reflect-audit.md (status: draft, r1).
// Heuristic-only: no LLM call, no agent spawn, no events emitted.
// Reuses CE-1's exports:
//   - extractKeywords + walkSolutionsCorpus  (researcher-history.ts)
//   - parseFrontmatter + resolveStateRoot    (state.ts)
//   - tokenize                                (dedup.ts)

import { readFile, readdir, mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import {
  extractKeywords,
  walkSolutionsCorpus,
} from "./agents/researcher-history"
import { parseFrontmatter, resolveStateRoot } from "./state"
import { tokenize } from "./dedup"

export interface ReflectCandidate {
  solution_ref: string
  category: string
  prevention_text: string | null
  keyword_overlap: number
  discussed: boolean
  discussed_evidence: string | null
}

export interface ReflectReport {
  task_id: string
  decision_path: string
  candidates: ReflectCandidate[]
}

export interface AuditOptions {
  /** YYYY-MM-DD; filters auditAllDecisions by intent.frontmatter.created_at. */
  since?: string
}

interface IntentFrontmatter {
  task_id?: string
  title?: string
  motivation?: string
  created_at?: string
}

interface SolutionFrontmatter {
  category?: string
  prevention?: string
  intent?: string
}

const MIN_SIGNAL_OVERLAP = 3
const PRE_MORTEM_HEADER = "## Pre-mortem"
const EARLY_SIGNAL_PREFIX = "Early signal:"

/**
 * Slice the `## Pre-mortem` segment out of an intent.md body. Returns
 * "" if the header is absent. Slice ends at the next `## ` (top-level
 * heading) or EOF, so adversarial subsections (`### [prob/impact] ...`)
 * stay inside.
 */
function slicePreMortem(raw: string): string {
  const idx = raw.indexOf(PRE_MORTEM_HEADER)
  if (idx < 0) return ""
  const tail = raw.slice(idx + PRE_MORTEM_HEADER.length)
  const endRel = tail.search(/\n## (?!#)/)
  return endRel < 0 ? raw.slice(idx) : raw.slice(idx, idx + PRE_MORTEM_HEADER.length + endRel)
}

/**
 * Extract every `Early signal: <text>` line from a pre-mortem segment.
 * Returns the lines verbatim (without the prefix), trimmed.
 */
function extractEarlySignals(preMortem: string): string[] {
  const out: string[] = []
  for (const line of preMortem.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.startsWith(EARLY_SIGNAL_PREFIX)) {
      out.push(trimmed.slice(EARLY_SIGNAL_PREFIX.length).trim())
    }
  }
  return out
}

/**
 * Detect whether `preMortem` references a candidate prevention.
 * Two-strike heuristic per CE-2 spec:
 *   (a) preMortem substring-contains the solution_ref
 *   (b) prevention first sentence shares ≥ MIN_SIGNAL_OVERLAP tokens
 *       with any `Early signal:` line
 * Returns { discussed: true, evidence } on hit; { discussed: false,
 * evidence: null } otherwise.
 */
function detectDiscussion(
  preMortem: string,
  solutionRef: string,
  preventionText: string,
  earlySignals: string[],
): { discussed: boolean; evidence: string | null } {
  // Strike (a) — direct solution_ref mention.
  if (preMortem.includes(solutionRef)) {
    return {
      discussed: true,
      evidence: `solution_ref direct match: ${solutionRef}`,
    }
  }
  // Strike (b) — token overlap on first sentence.
  const firstSentence = preventionText.split(/[.!?]/)[0] ?? ""
  const previewTokens = tokenize(firstSentence)
  if (previewTokens.size === 0 || earlySignals.length === 0) {
    return { discussed: false, evidence: null }
  }
  for (const signal of earlySignals) {
    const signalTokens = tokenize(signal)
    let overlap = 0
    for (const t of previewTokens) {
      if (signalTokens.has(t)) overlap++
    }
    if (overlap >= MIN_SIGNAL_OVERLAP) {
      return {
        discussed: true,
        evidence: `signal-token overlap (${overlap}): ${signal.slice(0, 80)}`,
      }
    }
  }
  return { discussed: false, evidence: null }
}

/**
 * Audit a single decision against the accumulated solutions corpus.
 *
 * Returns a ReflectReport whose `candidates` are keyword-overlapping
 * solutions that carry a non-empty `prevention` frontmatter field,
 * each tagged as `discussed` (mentioned in the decision's pre-mortem)
 * or `silent` (matched but not discussed).
 *
 * Defensive: a malformed or unreadable intent.md returns an empty
 * report with `decision_path` still set, never throws.
 */
export async function auditDecision(
  taskId: string,
  stateRoot?: string,
  // AuditOptions is reserved for symmetry with auditAllDecisions; --since
  // applies only at the corpus-traversal layer, not per-decision.
  _opts: AuditOptions = {},
): Promise<ReflectReport> {
  const root = resolveStateRoot(stateRoot)
  const decisionPath = resolve(root, "decisions", taskId, "intent.md")

  let raw: string
  try {
    raw = await readFile(decisionPath, "utf8")
  } catch {
    return { task_id: taskId, decision_path: decisionPath, candidates: [] }
  }

  let frontmatter: IntentFrontmatter
  try {
    frontmatter = parseFrontmatter<IntentFrontmatter>(raw).data
  } catch {
    return { task_id: taskId, decision_path: decisionPath, candidates: [] }
  }

  const keywordSource = `${frontmatter.motivation ?? ""}\n${frontmatter.title ?? ""}`
  const keywords = extractKeywords(keywordSource)
  if (keywords.length === 0) {
    return { task_id: taskId, decision_path: decisionPath, candidates: [] }
  }

  const scans = await walkSolutionsCorpus(root, keywords)
  const preMortem = slicePreMortem(raw)
  const earlySignals = extractEarlySignals(preMortem)

  const candidates: ReflectCandidate[] = []
  for (const scan of scans) {
    let solutionFrontmatter: SolutionFrontmatter
    try {
      solutionFrontmatter = parseFrontmatter<SolutionFrontmatter>(scan.text).data
    } catch {
      // Solutions/ may contain hand-edited fixtures with broken/missing
      // frontmatter. CE-1 obs #95 precedent: skip silently.
      continue
    }
    const preventionText = solutionFrontmatter.prevention?.trim() ?? ""
    if (preventionText === "") continue

    const solutionRef = `${scan.category}/${scan.slug}`
    const { discussed, evidence } = detectDiscussion(
      preMortem,
      solutionRef,
      preventionText,
      earlySignals,
    )
    candidates.push({
      solution_ref: solutionRef,
      category: scan.category,
      prevention_text: preventionText,
      keyword_overlap: scan.hits,
      discussed,
      discussed_evidence: evidence,
    })
  }

  // Sort: silent first (operator's attention surface), then by keyword
  // overlap descending within each group.
  candidates.sort((a, b) => {
    if (a.discussed !== b.discussed) return a.discussed ? 1 : -1
    return b.keyword_overlap - a.keyword_overlap
  })

  return { task_id: taskId, decision_path: decisionPath, candidates }
}

/**
 * Audit every decision under <stateRoot>/decisions/, optionally filtered
 * by `since` (intent.frontmatter.created_at ≥ since). Reports come back
 * sorted by created_at descending (most recent first).
 *
 * Missing decisions/ directory → returns []. Per-decision errors are
 * swallowed (skipped silently).
 */
export async function auditAllDecisions(
  stateRoot?: string,
  opts: AuditOptions = {},
): Promise<ReflectReport[]> {
  const root = resolveStateRoot(stateRoot)
  const decisionsDir = resolve(root, "decisions")

  let entries: { name: string; isDirectory: () => boolean }[]
  try {
    entries = await readdir(decisionsDir, { withFileTypes: true })
  } catch {
    return []
  }

  const sinceMs = opts.since ? Date.parse(opts.since) : null
  if (sinceMs !== null && Number.isNaN(sinceMs)) {
    throw new Error(`--since: not a parseable date: ${opts.since}`)
  }

  interface Pending {
    taskId: string
    createdAtMs: number
  }
  const pending: Pending[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const intentPath = resolve(decisionsDir, entry.name, "intent.md")
    let raw: string
    try {
      raw = await readFile(intentPath, "utf8")
    } catch {
      continue
    }
    let frontmatter: IntentFrontmatter
    try {
      frontmatter = parseFrontmatter<IntentFrontmatter>(raw).data
    } catch {
      continue
    }
    const createdAtMs = frontmatter.created_at
      ? Date.parse(frontmatter.created_at)
      : 0
    if (sinceMs !== null && createdAtMs < sinceMs) continue
    pending.push({ taskId: entry.name, createdAtMs })
  }

  // Most-recent-first.
  pending.sort((a, b) => b.createdAtMs - a.createdAtMs)

  const reports: ReflectReport[] = []
  for (const p of pending) {
    reports.push(await auditDecision(p.taskId, root))
  }
  return reports
}

/**
 * Render a ReflectReport as human-readable text. One section per
 * report; intended for stdout. Use --json on the CLI for machine
 * consumers.
 */
export function formatReport(report: ReflectReport): string {
  const lines: string[] = []
  lines.push(`# Reflect: ${report.task_id}`)
  lines.push("")
  lines.push(`Decision: ${report.decision_path}`)
  lines.push("")
  if (report.candidates.length === 0) {
    lines.push("No matched preventions.")
    return lines.join("\n")
  }
  lines.push(`Matched preventions: ${report.candidates.length}`)
  for (const c of report.candidates) {
    const tag = c.discussed ? "[discussed]" : "[silent]    "
    lines.push(`  - ${tag} ${c.solution_ref} (overlap: ${c.keyword_overlap})`)
    if (c.discussed && c.discussed_evidence) {
      lines.push(`    evidence: ${c.discussed_evidence}`)
    }
    if (!c.discussed && c.prevention_text) {
      const preview = c.prevention_text.split(/[.!?]/)[0]?.trim().slice(0, 80) ?? ""
      lines.push(`    prevention: ${preview}`)
    }
  }
  return lines.join("\n")
}

/**
 * Persist a report to <stateRoot>/reflections/<task_id>.md with
 * replace-on-rerun semantics. The reflections/ directory is created
 * on first write — ensureSgcStructure does NOT pre-create it.
 */
export async function writeReflectionFile(
  report: ReflectReport,
  stateRoot?: string,
): Promise<string> {
  const root = resolveStateRoot(stateRoot)
  const dir = resolve(root, "reflections")
  await mkdir(dir, { recursive: true })
  const path = resolve(dir, `${report.task_id}.md`)
  await writeFile(path, formatReport(report), "utf8")
  return path
}
