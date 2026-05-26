// src/dispatcher/handoff.ts
//
// GS-2 (f9) — sgc handoff session-state checkpoint capture.
//
// Spec: tasks/specs/gs-2-handoff.md
// Heuristic-only: no LLM, no agent spawn, no events emitted in v0.
// Scans .sgc/ state across 6 namespaces (decisions / plan-jobs /
// loop-runs / ship-failures / canaries / progress events.ndjson) + git
// status + recent commits; produces a typed HandoffSnapshot; renders
// to markdown; writes atomically to tasks/<slug>-paused.md outside .sgc/.

import { existsSync } from "node:fs"
import * as fs from "node:fs/promises"
import { join, dirname } from "node:path"
import { spawn as nodeSpawn } from "node:child_process"
import { parseFrontmatter } from "./state"
import { listJobs } from "./plan-jobs"
import { listLoopRuns } from "./loop"

export interface ActiveIntentSummary {
  task_id: string
  level: "L0" | "L1" | "L2" | "L3"
  title: string
  intent_path: string
  mtime: string
}

export interface VerifyCommandResult {
  source: "loop-run" | "plan-job" | "events-spawn" | "todo"
  command?: string
  context?: string
}

export interface PlanJobSummary {
  job_id: string
  status: "running" | "failed" | "stale"
  task: string
  pid?: number
  started_at: string
}

export interface LoopRunSummary {
  run_id: string
  status: "running" | "paused" | "failed"
  current_step: string
  task: string
  started_at: string
}

export interface UnpromotedCapture {
  kind: "ship-failure" | "canary"
  slug: string
  seed_excerpt?: string
}

export interface CommitOneline {
  sha: string
  subject: string
}

export interface UnclosedSpawn {
  spawn_id: string
  agent: string
  start_ts: string
}

export interface GitStatus {
  branch: string
  ahead?: number
  behind?: number
  changes: string[]
}

export interface HandoffSnapshot {
  slug: string
  generated_at: string
  cwd: string
  sgc_version: string
  active_intent?: ActiveIntentSummary
  verify_command: VerifyCommandResult
  plan_jobs: PlanJobSummary[]
  loop_runs: LoopRunSummary[]
  unpromoted_captures: UnpromotedCapture[]
  git: GitStatus
  recent_commits: CommitOneline[]
  unclosed_spawns: UnclosedSpawn[]
}

// Test-injection seam for git shell-outs (production: real `git` binary)
export interface GitProbe {
  branchAheadBehind: () => Promise<{ branch: string; ahead?: number; behind?: number }>
  statusPorcelain: () => Promise<string[]>
  recentCommits: (n: number) => Promise<CommitOneline[]>
}

// ── kebab/slug helpers ────────────────────────────────────────────────────

export function kebabize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function timestampFallback(now: Date): string {
  const iso = now.toISOString()
  return `${iso.slice(0, 10)}-${iso.slice(11, 16).replace(":", "")}-handoff`
}

export async function deriveSlug(stateRoot: string, now: Date): Promise<string> {
  const dateStr = now.toISOString().slice(0, 10)
  const decisionsDir = join(stateRoot, "decisions")
  if (!existsSync(decisionsDir)) return timestampFallback(now)

  const entries = await fs.readdir(decisionsDir, { withFileTypes: true })
  type IntentRef = { path: string; mtime: number; id: string }
  const intents: IntentRef[] = []
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const intentPath = join(decisionsDir, e.name, "intent.md")
    try {
      const stat = await fs.stat(intentPath)
      intents.push({ path: intentPath, mtime: stat.mtimeMs, id: e.name })
    } catch {
      // intent.md missing — skip this decision
    }
  }
  if (intents.length === 0) return timestampFallback(now)

  // Sort: mtime DESC, then id ASC (deterministic tie-break)
  intents.sort((a, b) => b.mtime - a.mtime || a.id.localeCompare(b.id))
  const newest = intents[0]!

  try {
    const text = await fs.readFile(newest.path, "utf-8")
    const fm = parseFrontmatter<{ title?: unknown }>(text).data
    const title = typeof fm.title === "string" ? fm.title : ""
    const kebab = kebabize(title)
    if (kebab.length === 0) return timestampFallback(now)
    const truncated = kebab.slice(0, SLUG_KEBAB_MAX).replace(/-+$/, "")
    if (truncated.length === 0) return timestampFallback(now)
    return `${dateStr}-${truncated}`
  } catch {
    return timestampFallback(now)
  }
}

// ── verify-command cascade (pure) ─────────────────────────────────────────

export function inferVerifyCommand(snapshot: HandoffSnapshot): VerifyCommandResult {
  // P1 — loop-run paused (strongest signal)
  const pausedLoop = snapshot.loop_runs.find((r) => r.status === "paused")
  if (pausedLoop) {
    return {
      source: "loop-run",
      command: `sgc loop --resume ${pausedLoop.run_id}`,
      context: `loop-run ${pausedLoop.run_id} paused at step:${pausedLoop.current_step}`,
    }
  }

  // P2 — plan-job running (pid alive, post lazy stale-detect)
  const runningJob = snapshot.plan_jobs.find((j) => j.status === "running")
  if (runningJob) {
    return {
      source: "plan-job",
      command: `sgc plan --status ${runningJob.job_id}`,
      context: `plan-job ${runningJob.job_id} running (pid ${runningJob.pid ?? "unknown"})`,
    }
  }

  // P3 — events.ndjson tail unclosed spawn
  const unclosed = snapshot.unclosed_spawns[0]
  if (unclosed) {
    return {
      source: "events-spawn",
      command: `sgc tail --since ${unclosed.start_ts}`,
      context: `spawn.start for agent ${unclosed.agent} (spawn_id ${unclosed.spawn_id}) at ${unclosed.start_ts} has no paired spawn.end in last ${EVENTS_TAIL_LINES} lines`,
    }
  }

  // P4 — TODO fallback
  return {
    source: "todo",
    context: "no in-flight loop/plan/spawn detected — operator-fill",
  }
}

// ── sub-gather stubs ──────────────────────────────────────────────────────

export async function gatherActiveIntent(
  stateRoot: string,
): Promise<ActiveIntentSummary | undefined> {
  const decisionsDir = join(stateRoot, "decisions")
  if (!existsSync(decisionsDir)) return undefined

  try {
    const entries = await fs.readdir(decisionsDir, { withFileTypes: true })
    type Ref = { path: string; mtime: number; id: string }
    const refs: Ref[] = []
    for (const e of entries) {
      if (!e.isDirectory()) continue
      const p = join(decisionsDir, e.name, "intent.md")
      try {
        const stat = await fs.stat(p)
        refs.push({ path: p, mtime: stat.mtimeMs, id: e.name })
      } catch {}
    }
    if (refs.length === 0) return undefined
    refs.sort((a, b) => b.mtime - a.mtime || a.id.localeCompare(b.id))
    const newest = refs[0]!
    const text = await fs.readFile(newest.path, "utf-8")
    const fm = parseFrontmatter<{ task_id?: unknown; level?: unknown; title?: unknown }>(text).data
    if (
      typeof fm.task_id !== "string" ||
      typeof fm.title !== "string" ||
      (fm.level !== "L0" && fm.level !== "L1" && fm.level !== "L2" && fm.level !== "L3")
    ) {
      return undefined
    }
    return {
      task_id: fm.task_id,
      level: fm.level,
      title: fm.title,
      intent_path: newest.path,
      mtime: new Date(newest.mtime).toISOString(),
    }
  } catch {
    return undefined
  }
}

export async function gatherPlanJobs(stateRoot: string): Promise<PlanJobSummary[]> {
  try {
    const jobs = await listJobs({ stateRoot })
    return jobs
      .filter((j) => j.status !== "done")
      .map((j) => ({
        job_id: j.job_id,
        status: j.status as PlanJobSummary["status"],
        task: j.task.slice(0, TASK_EXCERPT_MAX),
        pid: j.pid,
        started_at: j.started_at,
      }))
  } catch {
    return []
  }
}

export async function gatherLoopRuns(stateRoot: string): Promise<LoopRunSummary[]> {
  try {
    const runs = await listLoopRuns({ stateRoot })
    return runs
      .filter((r) => r.status !== "complete")
      .map((r) => ({
        run_id: r.run_id,
        status: r.status as LoopRunSummary["status"],
        current_step: String(r.current_step),
        task: r.task.slice(0, TASK_EXCERPT_MAX),
        started_at: r.started_at,
      }))
  } catch {
    return []
  }
}

type CaptureFM = {
  promoted_to?: unknown
  prevention_seed?: unknown
  regression_seed?: unknown
}

async function scanCaptureDir(
  dir: string,
  kind: "ship-failure" | "canary",
  seedField: "prevention_seed" | "regression_seed",
): Promise<UnpromotedCapture[]> {
  if (!existsSync(dir)) return []
  try {
    const entries = await fs.readdir(dir)
    const out: UnpromotedCapture[] = []
    for (const name of entries) {
      if (!name.endsWith(".md")) continue
      const slug = name.slice(0, -3)
      try {
        const text = await fs.readFile(join(dir, name), "utf-8")
        const fm = parseFrontmatter<CaptureFM>(text).data
        if (typeof fm.promoted_to === "string" && fm.promoted_to.length > 0) continue
        const rawSeed = fm[seedField]
        const seed =
          typeof rawSeed === "string" ? rawSeed.slice(0, SEED_EXCERPT_MAX) : undefined
        out.push({ kind, slug, seed_excerpt: seed })
      } catch {
        // malformed file — skip
      }
    }
    return out
  } catch {
    return []
  }
}

export async function gatherUnpromotedCaptures(stateRoot: string): Promise<UnpromotedCapture[]> {
  const [ships, canaries] = await Promise.all([
    scanCaptureDir(join(stateRoot, "ship-failures"), "ship-failure", "prevention_seed"),
    scanCaptureDir(join(stateRoot, "canaries"), "canary", "regression_seed"),
  ])
  return [...ships, ...canaries]
}

export async function gatherUnclosedSpawns(
  stateRoot: string,
  tailLines: number,
): Promise<UnclosedSpawn[]> {
  const eventsPath = join(stateRoot, "progress", "events.ndjson")
  if (!existsSync(eventsPath)) return []

  try {
    const text = await fs.readFile(eventsPath, "utf-8")
    const allLines = text.split("\n").filter((l) => l.length > 0)
    const lines = allLines.slice(-tailLines)

    type StartEvent = { spawn_id: string; agent: string; ts: string }
    const starts = new Map<string, StartEvent>()
    const endedIds = new Set<string>()

    for (const line of lines) {
      let evt: {
        event_type?: unknown
        spawn_id?: unknown
        agent?: unknown
        ts?: unknown
      }
      try {
        evt = JSON.parse(line)
      } catch {
        continue
      }
      if (typeof evt.spawn_id !== "string" || typeof evt.event_type !== "string") continue
      if (evt.event_type === "spawn.start") {
        if (typeof evt.agent === "string" && typeof evt.ts === "string") {
          starts.set(evt.spawn_id, {
            spawn_id: evt.spawn_id,
            agent: evt.agent,
            ts: evt.ts,
          })
        }
      } else if (evt.event_type === "spawn.end") {
        endedIds.add(evt.spawn_id)
      }
    }

    const unclosed: UnclosedSpawn[] = []
    for (const [id, s] of starts) {
      if (!endedIds.has(id)) {
        unclosed.push({ spawn_id: id, agent: s.agent, start_ts: s.ts })
      }
    }
    unclosed.sort((a, b) => b.start_ts.localeCompare(a.start_ts))
    return unclosed
  } catch {
    return []
  }
}

async function runGit(args: string[], cwd: string = process.cwd()): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = nodeSpawn("git", args, { cwd })
    let stdout = ""
    let stderr = ""
    child.stdout?.on("data", (d) => (stdout += d.toString()))
    child.stderr?.on("data", (d) => (stderr += d.toString()))
    child.on("error", (err) => reject(err))
    child.on("close", (code) => {
      if (code === 0) resolve(stdout)
      else reject(new Error(`git ${args.join(" ")} exited ${code}: ${stderr}`))
    })
  })
}

export function defaultGitProbe(cwd: string = process.cwd()): GitProbe {
  return {
    async branchAheadBehind() {
      const branch = (await runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd)).trim()
      let ahead: number | undefined
      let behind: number | undefined
      try {
        const counts = (
          await runGit(["rev-list", "--left-right", "--count", "@{upstream}...HEAD"], cwd)
        ).trim()
        const [b, a] = counts.split(/\s+/).map(Number)
        if (!Number.isNaN(a) && !Number.isNaN(b)) {
          ahead = a
          behind = b
        }
      } catch {
        // no upstream — leave ahead/behind undefined
      }
      return { branch, ahead, behind }
    },
    async statusPorcelain() {
      const text = await runGit(["status", "--porcelain=v1"], cwd)
      return text
        .split(/\r?\n/)
        .filter((l) => l.length > 0)
        .slice(0, 10)
    },
    async recentCommits(n) {
      const text = await runGit(["log", `-${n}`, "--pretty=format:%h\t%s"], cwd)
      return text
        .split(/\r?\n/)
        .filter((l) => l.length > 0)
        .map((l) => {
          const [sha, ...rest] = l.split("\t")
          return { sha: sha ?? "", subject: rest.join("\t").slice(0, 80) }
        })
    },
  }
}

export async function gatherGit(probe?: GitProbe): Promise<GitStatus> {
  const p = probe ?? defaultGitProbe()
  try {
    const { branch, ahead, behind } = await p.branchAheadBehind()
    const changes = await p.statusPorcelain()
    return { branch, ahead, behind, changes }
  } catch {
    return { branch: "(not a git repo)", changes: [] }
  }
}

export async function gatherRecentCommits(probe?: GitProbe): Promise<CommitOneline[]> {
  const p = probe ?? defaultGitProbe()
  try {
    return await p.recentCommits(3)
  } catch {
    return []
  }
}

// ── orchestrator + render + write ─────────────────────────────────────────

export interface GatherOptions {
  now?: Date
  git?: GitProbe
  sgcVersion?: string
}

export async function gatherHandoffState(
  stateRoot: string,
  repoRoot: string,
  opts?: GatherOptions,
): Promise<HandoffSnapshot> {
  throw new Error("not implemented")
}

export function renderHandoffMarkdown(snapshot: HandoffSnapshot): string {
  throw new Error("not implemented")
}

export async function writeHandoffMarkdown(
  repoRoot: string,
  slug: string,
  content: string,
): Promise<string> {
  throw new Error("not implemented")
}

export const EVENTS_TAIL_LINES = 500
export const SEED_EXCERPT_MAX = 80
export const SLUG_KEBAB_MAX = 40
export const TASK_EXCERPT_MAX = 80
