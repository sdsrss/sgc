// `sgc cso` — Chief Security Officer pre-ship review.
//
// Three heuristic checks, exit-code gated:
//   1. secret-scan      — regex set over staged + recent diff (T2)
//   2. dependency-audit — shell to bun/npm audit (T3)
//   3. events-anomaly   — unpaired spawn.start Tier-1 per Invariant §13 (T4)
//
// Output: .sgc/cso/<YYYY-MM-DD>-<HHMM>-<rand>.md (append-only per
// Invariant §6) + .sgc/cso/last-report.json (rewritten snapshot,
// machine-readable for reviewer.correctness L3 advisory line).
//
// Exit semantics: 0 = pass, 0 = warn (advisory), 1 = fail (blocking).
// Default: opt-in; no auto-run from /ship in v1.17.0.

import { execSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { resolveStateRoot, serializeFrontmatter, writeAtomic } from "../dispatcher/state"
import { createLogger, type Logger } from "../dispatcher/logger"

export type CsoVerdict = "pass" | "warn" | "fail"

export interface CsoCheckResult {
  name: string
  verdict: CsoVerdict
  findings: string[]
  warnings: string[]
}

export interface CsoReport {
  generated_at: string
  verdict: CsoVerdict
  checks: CsoCheckResult[]
}

export interface CsoOptions {
  stateRoot?: string
  /** Repo root for git/audit shell-outs. Default: process.cwd(). */
  repoRoot?: string
  log?: (msg: string) => void
  logger?: Logger
}

function isoStamp(): { date: string; time: string; iso: string } {
  const d = new Date()
  const iso = d.toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16).replace(":", ""), iso }
}

function rankVerdict(v: CsoVerdict): number {
  return v === "fail" ? 2 : v === "warn" ? 1 : 0
}

export function aggregateVerdict(checks: CsoCheckResult[]): CsoVerdict {
  let worst: CsoVerdict = "pass"
  for (const c of checks) {
    if (rankVerdict(c.verdict) > rankVerdict(worst)) worst = c.verdict
  }
  return worst
}

export function ensureCsoDir(stateRoot?: string): string {
  const root = resolveStateRoot(stateRoot)
  const dir = resolve(root, "cso")
  mkdirSync(dir, { recursive: true })
  return dir
}

function renderReportBody(report: CsoReport): string {
  const lines: string[] = []
  lines.push(`# CSO security review — ${report.verdict.toUpperCase()}`)
  lines.push("")
  lines.push(`Generated: ${report.generated_at}`)
  lines.push("")
  for (const c of report.checks) {
    lines.push(`## ${c.name} — ${c.verdict}`)
    lines.push("")
    if (c.findings.length > 0) {
      lines.push("### Findings")
      for (const f of c.findings) lines.push(`- ${f}`)
      lines.push("")
    }
    if (c.warnings.length > 0) {
      lines.push("### Warnings")
      for (const w of c.warnings) lines.push(`- ${w}`)
      lines.push("")
    }
    if (c.findings.length === 0 && c.warnings.length === 0) {
      lines.push("_(no findings)_")
      lines.push("")
    }
  }
  return lines.join("\n")
}

function reportSlug(stamp: { date: string; time: string }): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `${stamp.date}-${stamp.time}-${rand}`
}

// ─────────────────────────────────────────────────────────────────────────
// T2: secret-scan
// ─────────────────────────────────────────────────────────────────────────

const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "AWS access key", re: /AKIA[0-9A-Z]{16}/ },
  { name: "private key block", re: /-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/ },
  { name: "GitHub PAT", re: /gh[ps]_[A-Za-z0-9]{36,}/ },
  { name: "OpenAI API key", re: /sk-[A-Za-z0-9]{20,}/ },
  { name: "Slack token", re: /xox[abprs]-[A-Za-z0-9-]{10,}/ },
  {
    name: "generic api-key/password assignment",
    re: /\b(?:api[_-]?key|api[_-]?secret|access[_-]?token|password|secret[_-]?key|private[_-]?key)\s*[=:]\s*["'][^"'\s]{16,}["']/i,
  },
]

const SCAN_EXCLUDE_PATHS = [
  ".sgc/cso/",
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  "coverage/",
  "tmp/",
]

function listScanFiles(repoRoot: string): { files: string[]; warnings: string[] } {
  const warnings: string[] = []
  let raw = ""
  try {
    raw = execSync("git ls-files --cached --modified --others --exclude-standard", {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    warnings.push(`git ls-files failed: ${msg.slice(0, 120)}; secret-scan skipped`)
    return { files: [], warnings }
  }
  const files = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((p) => !SCAN_EXCLUDE_PATHS.some((ex) => p.startsWith(ex)))
  return { files, warnings }
}

const MAX_SCAN_BYTES = 200_000

export function scanSecrets(repoRoot: string): CsoCheckResult {
  const { files, warnings } = listScanFiles(repoRoot)
  const findings: string[] = []
  for (const rel of files) {
    const abs = resolve(repoRoot, rel)
    if (!existsSync(abs)) continue
    let stat
    try {
      stat = statSync(abs)
    } catch {
      continue
    }
    if (!stat.isFile()) continue
    if (stat.size > MAX_SCAN_BYTES) {
      warnings.push(`${rel}: ${stat.size} bytes exceeds ${MAX_SCAN_BYTES} scan cap, skipped`)
      continue
    }
    let content: string
    try {
      content = readFileSync(abs, "utf8")
    } catch {
      continue
    }
    for (const { name, re } of SECRET_PATTERNS) {
      const m = re.exec(content)
      if (m) {
        const line = content.slice(0, m.index).split(/\r?\n/).length
        findings.push(`${rel}:${line} matches ${name}`)
      }
    }
  }
  const verdict: CsoVerdict = findings.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass"
  return { name: "secret-scan", verdict, findings, warnings }
}

// ─────────────────────────────────────────────────────────────────────────
// T3: dependency-audit
// ─────────────────────────────────────────────────────────────────────────

interface AuditAttempt {
  tool: string
  cmd: string
  stdout: string
  exitCode: number
}

function tryAudit(repoRoot: string, cmd: string): AuditAttempt | null {
  try {
    const stdout = execSync(cmd, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000,
    })
    return { tool: cmd.split(/\s+/)[0]!, cmd, stdout, exitCode: 0 }
  } catch (err) {
    const e = err as { status?: number; stdout?: Buffer | string; message?: string }
    // npm/bun audit exit non-zero when vulnerabilities found — still parseable
    if (e.stdout) {
      const stdout = typeof e.stdout === "string" ? e.stdout : e.stdout.toString("utf8")
      if (stdout.trim().length > 0) {
        return { tool: cmd.split(/\s+/)[0]!, cmd, stdout, exitCode: e.status ?? 1 }
      }
    }
    return null
  }
}

interface AuditCounts {
  critical: number
  high: number
  moderate: number
  low: number
  total: number
}

function parseNpmAudit(stdout: string): AuditCounts | null {
  try {
    const j = JSON.parse(stdout) as {
      metadata?: { vulnerabilities?: Partial<AuditCounts> & { info?: number } }
    }
    const v = j.metadata?.vulnerabilities
    if (!v) return null
    return {
      critical: v.critical ?? 0,
      high: v.high ?? 0,
      moderate: v.moderate ?? 0,
      low: v.low ?? 0,
      total: v.total ?? (v.critical ?? 0) + (v.high ?? 0) + (v.moderate ?? 0) + (v.low ?? 0),
    }
  } catch {
    return null
  }
}

export function auditDependencies(repoRoot: string): CsoCheckResult {
  const findings: string[] = []
  const warnings: string[] = []
  const attempts = ["bun audit --json", "npm audit --json"]
  let result: AuditAttempt | null = null
  for (const cmd of attempts) {
    result = tryAudit(repoRoot, cmd)
    if (result) break
  }
  if (!result) {
    warnings.push(`no audit tool available (tried: ${attempts.join(", ")}); dep audit skipped`)
    return { name: "dependency-audit", verdict: "warn", findings, warnings }
  }
  const counts = parseNpmAudit(result.stdout)
  if (!counts) {
    warnings.push(`${result.tool} audit returned non-JSON or unparseable output; dep audit skipped`)
    return { name: "dependency-audit", verdict: "warn", findings, warnings }
  }
  if (counts.critical > 0) findings.push(`${counts.critical} critical vulnerability(ies) via ${result.tool}`)
  if (counts.high > 0) findings.push(`${counts.high} high vulnerability(ies) via ${result.tool}`)
  if (counts.moderate > 0) warnings.push(`${counts.moderate} moderate vulnerability(ies) via ${result.tool}`)
  if (counts.low > 0) warnings.push(`${counts.low} low vulnerability(ies) via ${result.tool}`)
  const verdict: CsoVerdict = findings.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass"
  return { name: "dependency-audit", verdict, findings, warnings }
}

// ─────────────────────────────────────────────────────────────────────────
// T4: events.ndjson anomaly check (Invariant §13 Tier-1 pairing)
// ─────────────────────────────────────────────────────────────────────────

interface EventLite {
  ts: string
  task_id: string | null
  spawn_id: string | null
  event_type: string
}

const ANOMALY_TAIL_BYTES = 2_000_000 // ~2MB tail; covers thousands of events

function readEventsTail(eventsPath: string): { lines: string[]; warnings: string[] } {
  const warnings: string[] = []
  if (!existsSync(eventsPath)) {
    warnings.push(`events.ndjson not found at ${eventsPath}; anomaly check skipped`)
    return { lines: [], warnings }
  }
  let raw: string
  try {
    const st = statSync(eventsPath)
    if (st.size === 0) {
      warnings.push("events.ndjson is empty; anomaly check skipped")
      return { lines: [], warnings }
    }
    // For now, read the whole file — events streams are typically <50MB.
    // Future optimization: seek to last ANOMALY_TAIL_BYTES.
    raw = readFileSync(eventsPath, "utf8")
    if (raw.length > ANOMALY_TAIL_BYTES) {
      const tail = raw.slice(-ANOMALY_TAIL_BYTES)
      const firstNl = tail.indexOf("\n")
      raw = firstNl >= 0 ? tail.slice(firstNl + 1) : tail
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    warnings.push(`failed to read events.ndjson: ${msg.slice(0, 120)}; anomaly check skipped`)
    return { lines: [], warnings }
  }
  const lines = raw.split(/\r?\n/).filter((s) => s.length > 0)
  return { lines, warnings }
}

function parseEventLine(line: string): EventLite | null {
  try {
    const j = JSON.parse(line) as Partial<EventLite>
    if (typeof j.event_type !== "string") return null
    return {
      ts: typeof j.ts === "string" ? j.ts : "",
      task_id: typeof j.task_id === "string" ? j.task_id : null,
      spawn_id: typeof j.spawn_id === "string" ? j.spawn_id : null,
      event_type: j.event_type,
    }
  } catch {
    return null
  }
}

export function detectAnomalies(stateRoot?: string): CsoCheckResult {
  const root = resolveStateRoot(stateRoot)
  const eventsPath = resolve(root, "progress/events.ndjson")
  const findings: string[] = []
  const { lines, warnings } = readEventsTail(eventsPath)
  if (lines.length === 0) {
    return { name: "events-anomaly", verdict: "warn", findings, warnings }
  }

  // Tier-1 pair tracking: spawn.start <-> spawn.end on same spawn_id.
  const openSpawns = new Map<string, EventLite>()
  let malformed = 0
  for (const line of lines) {
    const e = parseEventLine(line)
    if (!e) {
      malformed++
      continue
    }
    if (e.event_type === "spawn.start" && e.spawn_id) {
      openSpawns.set(e.spawn_id, e)
    } else if (e.event_type === "spawn.end" && e.spawn_id) {
      openSpawns.delete(e.spawn_id)
    }
  }

  if (malformed > 0) {
    warnings.push(`${malformed} malformed event line(s) skipped`)
  }
  for (const [spawnId, e] of openSpawns) {
    findings.push(`unpaired spawn.start: ${spawnId} (ts=${e.ts}, task_id=${e.task_id ?? "null"})`)
  }
  // Cap reporting noise: > 20 unpaired = systemic; truncate display.
  if (findings.length > 20) {
    const overflow = findings.length - 20
    findings.length = 20
    findings.push(`… ${overflow} more unpaired spawn.start entries truncated`)
  }
  const verdict: CsoVerdict =
    findings.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass"
  return { name: "events-anomaly", verdict, findings, warnings }
}

export async function runCso(
  opts: CsoOptions = {},
): Promise<{ report: CsoReport; reportPath: string; lastReportPath: string }> {
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot, say: opts.log })
  const log = (m: string) => logger.say(m)
  const dir = ensureCsoDir(opts.stateRoot)
  const repoRoot = opts.repoRoot ?? process.cwd()

  const secretsCheck = scanSecrets(repoRoot)
  const depsCheck = auditDependencies(repoRoot)
  const anomalyCheck = detectAnomalies(opts.stateRoot)

  const stamp = isoStamp()
  const checks = [secretsCheck, depsCheck, anomalyCheck]
  const report: CsoReport = {
    generated_at: stamp.iso,
    verdict: aggregateVerdict(checks),
    checks,
  }

  const slug = reportSlug(stamp)
  const mdPath = resolve(dir, `${slug}.md`)
  const md = serializeFrontmatter(
    { generated_at: stamp.iso, verdict: report.verdict, slug },
    renderReportBody(report),
  )
  writeAtomic(mdPath, md)

  const lastReportPath = resolve(dir, "last-report.json")
  writeAtomic(lastReportPath, JSON.stringify(report, null, 2) + "\n")

  log(`cso verdict: ${report.verdict}`)
  for (const c of checks) {
    log(`  ${c.name}: ${c.verdict} (${c.findings.length} finding(s), ${c.warnings.length} warning(s))`)
  }
  log(`report: ${mdPath}`)

  return { report, reportPath: mdPath, lastReportPath }
}
