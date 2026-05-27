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
import { createLogger } from "./logger"
import { existsSync } from "node:fs"
import { readFile, readdir, writeFile, rename, mkdir } from "node:fs/promises"
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

export function renderInvestigationBody(parts: {
  investigate: InvestigateFacts
  analyze: AnalyzeOutput
  hypothesize: string[]
}): string {
  const lines: string[] = []

  // Section 1 — Investigate
  lines.push("## 1 — Investigate")
  lines.push("")
  if (parts.investigate.git_head) {
    lines.push(`- git_head: ${parts.investigate.git_head}`)
  }
  if (parts.investigate.git_status_paths.length > 0) {
    lines.push("- git_status (first 20):")
    for (const p of parts.investigate.git_status_paths) lines.push(`  - ${p}`)
  } else {
    lines.push("- git_status: (clean)")
  }
  if (parts.investigate.recent_events.length > 0) {
    lines.push("- recent_events (tail 50):")
    for (const e of parts.investigate.recent_events.slice(-10)) {
      lines.push(`  - ${e.ts} ${e.event_type} ${e.agent}`)
    }
  } else {
    lines.push("- recent_events: (none)")
  }
  for (const err of parts.investigate.errors) {
    lines.push(`- ⚠ ${err}`)
  }

  // Section 2 — Analyze
  lines.push("")
  lines.push("## 2 — Analyze")
  lines.push("")
  lines.push("Prior preventions:")
  if (parts.analyze.prior_preventions.length === 0) {
    lines.push("- (none)")
  } else {
    for (const h of parts.analyze.prior_preventions) {
      lines.push(
        `- ${h.solution_ref} (score ${h.overlap_score.toFixed(2)}): ${h.prevention_excerpt}`,
      )
    }
  }
  lines.push("")
  lines.push("Historical signatures:")
  if (parts.analyze.historical_signatures.length === 0) {
    lines.push("- (none)")
  } else {
    for (const h of parts.analyze.historical_signatures) {
      lines.push(`- ${h.kind}/${h.slug}: ${h.excerpt}`)
    }
  }
  lines.push("")
  lines.push("Three-strike:")
  if (parts.analyze.three_strike.length === 0) {
    lines.push("- (none)")
  } else {
    for (const t of parts.analyze.three_strike) {
      lines.push(
        `- ⚠ three-strike: ${t.signature} (${t.count} occurrences; consider rollback per §6)`,
      )
    }
  }
  for (const err of parts.analyze.errors) {
    lines.push(`- ⚠ ${err}`)
  }

  // Section 3 — Hypothesize
  lines.push("")
  lines.push("## 3 — Hypothesize")
  lines.push("")
  for (let i = 0; i < parts.hypothesize.length; i++) {
    lines.push(`${i + 1}. ${parts.hypothesize[i]}`)
  }

  // Section 4 — Implement (operator-fill)
  lines.push("")
  lines.push("## 4 — Implement")
  lines.push("")
  lines.push("(operator: fill root_cause + fix_commit + verify_command, then `sgc debug close`)")
  lines.push("")

  return lines.join("\n")
}

function renderFrontmatter(fm: InvestigationFrontmatter): string {
  const lines = [
    "---",
    `id: ${fm.id}`,
    `status: ${fm.status}`,
    `current_phase: ${fm.current_phase}`,
    `symptom: ${JSON.stringify(fm.symptom)}`,
    `started_at: ${fm.started_at}`,
    `closed_at: ${fm.closed_at ?? "null"}`,
    `root_cause: ${fm.root_cause === null ? "null" : JSON.stringify(fm.root_cause)}`,
    `fix_commit: ${fm.fix_commit ?? "null"}`,
    `verify_command: ${fm.verify_command === null ? "null" : JSON.stringify(fm.verify_command)}`,
    "---",
  ]
  return lines.join("\n") + "\n"
}

export async function writeInvestigation(opts: {
  stateRoot: string
  id: string
  frontmatter: InvestigationFrontmatter
  body: string
}): Promise<string> {
  const dir = join(opts.stateRoot, "investigations")
  await mkdir(dir, { recursive: true })
  const target = join(dir, `${opts.id}.md`)
  const tmp = `${target}.tmp.${process.pid}.${Date.now()}`
  const content = renderFrontmatter(opts.frontmatter) + opts.body
  await writeFile(tmp, content, "utf8")
  await rename(tmp, target)
  return target
}

async function resolveCollisionId(stateRoot: string, baseId: string): Promise<string> {
  const dir = join(stateRoot, "investigations")
  if (!existsSync(join(dir, `${baseId}.md`))) return baseId
  for (let n = 2; n < 100; n++) {
    const candidate = `${baseId}-${n}`
    if (!existsSync(join(dir, `${candidate}.md`))) return candidate
  }
  throw new Error(`collision: too many same-minute investigations for ${baseId}`)
}

const SHA_RE = /^[0-9a-f]{7,40}$/

async function readInvestigationContent(
  stateRoot: string,
  id: string,
): Promise<{ path: string; content: string } | null> {
  const path = join(stateRoot, "investigations", `${id}.md`)
  try {
    const content = await readFile(path, "utf8")
    return { path, content }
  } catch {
    return null
  }
}

export async function runDebugClose(opts: DebugCloseOptions): Promise<DebugResult> {
  const stateRoot = opts.stateRoot ?? join(process.cwd(), ".sgc")
  const stderrWrite = opts.stderrWrite ?? ((c: string) => { process.stderr.write(c) })
  const stdoutWrite = opts.stdoutWrite ?? ((c: string) => { process.stdout.write(c) })
  const now = (opts.now ?? (() => new Date()))()
  const logger = opts.logger ?? createLogger({ stateRoot })

  // Suppress unused variable warning — stdoutWrite is part of the public API
  void stdoutWrite

  // Iron Law #3 hard-gate: validate flags BEFORE any disk read.
  const rootCause = opts.rootCause.trim()
  const fixCommit = opts.fixCommit.trim()
  const verifyCommand = opts.verifyCommand.trim()

  if (rootCause.length === 0) {
    stderrWrite("close refused: --root-cause required (Iron Law #3)\n")
    return { exitCode: 1 }
  }
  if (!SHA_RE.test(fixCommit)) {
    stderrWrite("close refused: --fix-commit must be 7-40 hex chars (Iron Law #3)\n")
    return { exitCode: 1 }
  }
  if (verifyCommand.length === 0) {
    stderrWrite("close refused: --verify-command required (Iron Law #3)\n")
    return { exitCode: 1 }
  }

  const existing = await readInvestigationContent(stateRoot, opts.id)
  if (!existing) {
    stderrWrite(`close refused: no investigation at ${join(stateRoot, "investigations", `${opts.id}.md`)}\n`)
    return { exitCode: 1 }
  }

  // Parse frontmatter to check status.
  let fmData: Partial<InvestigationFrontmatter> = {}
  try {
    const fm = parseFrontmatter<Partial<InvestigationFrontmatter>>(existing.content)
    fmData = fm.data
  } catch {
    stderrWrite(`close refused: ${opts.id} frontmatter unparseable\n`)
    return { exitCode: 1 }
  }
  if (fmData.status === "closed") {
    stderrWrite(`close refused: ${opts.id} already closed\n`)
    return { exitCode: 1 }
  }

  // Extract body (everything after closing ---). Preserve existing sections 1-4
  // and append section 5.
  const bodyStart = existing.content.indexOf("\n---\n")
  const bodyContent =
    bodyStart >= 0 ? existing.content.slice(bodyStart + "\n---\n".length) : ""

  const updatedBody =
    bodyContent.trimEnd() +
    "\n\n## 5 — Fix evidence\n\n" +
    `- root_cause: ${rootCause}\n` +
    `- fix_commit: ${fixCommit}\n` +
    `- verify_command: \`${verifyCommand}\`\n` +
    `- closed_at: ${now.toISOString()}\n`

  await writeInvestigation({
    stateRoot,
    id: opts.id,
    frontmatter: {
      id: opts.id,
      status: "closed",
      current_phase: "closed",
      symptom: String(fmData.symptom ?? ""),
      started_at: String(fmData.started_at ?? ""),
      closed_at: now.toISOString(),
      root_cause: rootCause,
      fix_commit: fixCommit,
      verify_command: verifyCommand,
    },
    body: updatedBody,
  })

  logger.event({
    task_id: opts.id,
    spawn_id: opts.id,
    agent: "sgc.debug",
    event_type: "debug.closed",
    level: "info",
    payload: {
      investigation_id: opts.id,
      root_cause: rootCause,
      fix_commit: fixCommit,
      verify_command: verifyCommand,
    },
  })

  stderrWrite(`closed: ${opts.id}\n`)
  return { exitCode: 0 }
}

export async function runDebugList(opts: DebugListOptions): Promise<DebugResult> {
  const stateRoot = opts.stateRoot ?? join(process.cwd(), ".sgc")
  const stdoutWrite = opts.stdoutWrite ?? ((c: string) => { process.stdout.write(c) })
  const dir = join(stateRoot, "investigations")

  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    stdoutWrite("no investigations\n")
    return { exitCode: 0 }
  }

  const records: Array<{
    id: string
    status: string
    started_at: string
    symptom: string
  }> = []
  for (const name of entries) {
    if (!name.endsWith(".md")) continue
    try {
      const content = await readFile(join(dir, name), "utf8")
      const fm = parseFrontmatter<Partial<InvestigationFrontmatter>>(content)
      records.push({
        id: String(fm.data.id ?? name.replace(/\.md$/, "")),
        status: String(fm.data.status ?? "?"),
        started_at: String(fm.data.started_at ?? ""),
        symptom: String(fm.data.symptom ?? "").slice(0, 60),
      })
    } catch {
      continue
    }
  }

  if (records.length === 0) {
    stdoutWrite("no investigations\n")
    return { exitCode: 0 }
  }

  records.sort((a, b) => b.started_at.localeCompare(a.started_at))
  stdoutWrite("ID                                    STATUS       SYMPTOM\n")
  for (const r of records) {
    stdoutWrite(`${r.id.padEnd(38)}${r.status.padEnd(13)}${r.symptom}\n`)
  }
  return { exitCode: 0 }
}

export async function runDebugStart(opts: DebugStartOptions): Promise<DebugResult> {
  const stateRoot = opts.stateRoot ?? join(opts.repoRoot ?? process.cwd(), ".sgc")
  const repoRoot = opts.repoRoot ?? process.cwd()
  const heuristic = opts.heuristic ?? defaultHeuristic()
  const now = (opts.now ?? (() => new Date()))()
  const logger = opts.logger ?? createLogger({ stateRoot })
  const stdoutWrite = opts.stdoutWrite ?? ((c: string) => { process.stdout.write(c) })
  const stderrWrite = opts.stderrWrite ?? ((c: string) => { process.stderr.write(c) })

  const baseId = deriveInvestigationId(opts.symptom, now)
  let id: string
  try {
    id = await resolveCollisionId(stateRoot, baseId)
  } catch (err) {
    stderrWrite(`debug failed: ${(err as Error).message}\n`)
    return { exitCode: 1 }
  }

  // Event 1: debug.start
  logger.event({
    task_id: id,
    spawn_id: id,
    agent: "sgc.debug",
    event_type: "debug.start",
    level: "info",
    payload: { investigation_id: id, symptom: opts.symptom },
  })

  // Phase 1: investigate
  let investigateFacts: InvestigateFacts
  try {
    investigateFacts = await heuristic.gatherInvestigateFacts({ stateRoot, repoRoot })
  } catch (err) {
    investigateFacts = {
      git_status_paths: [],
      recent_events: [],
      errors: [`gatherInvestigateFacts threw: ${(err as Error).message.slice(0, 80)}`],
    }
    logger.event({
      task_id: id,
      spawn_id: id,
      agent: "sgc.debug",
      event_type: "debug.heuristic_failed",
      level: "warn",
      payload: {
        investigation_id: id,
        phase: "investigate",
        error_class: (err as Error).constructor.name,
        error_message: (err as Error).message,
      },
    })
  }

  // Event 2: debug.phase_complete investigate
  logger.event({
    task_id: id,
    spawn_id: id,
    agent: "sgc.debug",
    event_type: "debug.phase_complete",
    level: "info",
    payload: { investigation_id: id, phase: "investigate" },
  })

  // Phase 2: analyze — 3 sub-readers in parallel, each with individual catch
  const failedPayloadFor = (phase: string, err: unknown) => ({
    investigation_id: id,
    phase,
    error_class: (err as Error).constructor.name,
    error_message: (err as Error).message,
  })

  const [priorPreventions, threeStrike, historicalSignatures] = await Promise.all([
    heuristic.analyzeCorpus({ stateRoot, symptom: opts.symptom }).catch((err) => {
      logger.event({
        task_id: id,
        spawn_id: id,
        agent: "sgc.debug",
        event_type: "debug.heuristic_failed",
        level: "warn",
        payload: failedPayloadFor("analyze", err),
      })
      return [] as CorpusHit[]
    }),
    heuristic.detectThreeStrike({ stateRoot }).catch((err) => {
      logger.event({
        task_id: id,
        spawn_id: id,
        agent: "sgc.debug",
        event_type: "debug.heuristic_failed",
        level: "warn",
        payload: failedPayloadFor("analyze", err),
      })
      return [] as ThreeStrikeHit[]
    }),
    heuristic.scanHistoricalSignatures({ stateRoot, symptom: opts.symptom }).catch((err) => {
      logger.event({
        task_id: id,
        spawn_id: id,
        agent: "sgc.debug",
        event_type: "debug.heuristic_failed",
        level: "warn",
        payload: failedPayloadFor("analyze", err),
      })
      return [] as HistoricalSignatureHit[]
    }),
  ])

  const analyze: AnalyzeOutput = {
    prior_preventions: priorPreventions,
    historical_signatures: historicalSignatures,
    three_strike: threeStrike,
    errors: [],
  }

  // Event 3: debug.phase_complete analyze
  logger.event({
    task_id: id,
    spawn_id: id,
    agent: "sgc.debug",
    event_type: "debug.phase_complete",
    level: "info",
    payload: { investigation_id: id, phase: "analyze" },
  })

  // Phase 3: hypothesize — compose from analyze hits
  const hypothesize: string[] = []
  for (const h of priorPreventions) {
    hypothesize.push(`${h.solution_ref} — ${h.prevention_excerpt}`)
  }
  for (const h of historicalSignatures) {
    hypothesize.push(`${h.kind}/${h.slug} — ${h.excerpt}`)
  }
  for (const t of threeStrike) {
    hypothesize.push(`three-strike: ${t.signature} (${t.count} occurrences)`)
  }
  if (hypothesize.length === 0) {
    hypothesize.push("No prior matches. Operator-formulated hypothesis required.")
  }

  // Event 4: debug.phase_complete hypothesize
  logger.event({
    task_id: id,
    spawn_id: id,
    agent: "sgc.debug",
    event_type: "debug.phase_complete",
    level: "info",
    payload: { investigation_id: id, phase: "hypothesize" },
  })

  // Render + write investigation file
  const body = renderInvestigationBody({ investigate: investigateFacts, analyze, hypothesize })
  const path = await writeInvestigation({
    stateRoot,
    id,
    frontmatter: {
      id,
      status: "in_progress",
      current_phase: "implement",
      symptom: opts.symptom,
      started_at: now.toISOString(),
      closed_at: null,
      root_cause: null,
      fix_commit: null,
      verify_command: null,
    },
    body,
  })

  // stdout = hypothesize section (operator-facing); stderr = path
  stdoutWrite("## 3 — Hypothesize\n\n")
  for (let i = 0; i < hypothesize.length; i++) {
    stdoutWrite(`${i + 1}. ${hypothesize[i]}\n`)
  }
  stderrWrite(`started: ${path}\n`)

  return { exitCode: 0 }
}
