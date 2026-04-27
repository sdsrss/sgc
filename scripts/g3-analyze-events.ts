#!/usr/bin/env bun
// G.3 deliverable per parent spec §8.4.
//
// Reads one or more `.sgc/progress/events.ndjson` files and prints four
// summaries: (1) spawn-latency histogram, (2) LLM failure rate,
// (3) verdict distribution, (4) prompt-chars vs latency correlation.
//
// Usage:
//   bun run scripts/g3-analyze-events.ts <events.ndjson> [more.ndjson ...]
//
// Output is plain text suitable for pasting into docs/experiments/g3-e2e.md
// per spec §8.5 evidence gate #2.

import { readFileSync, existsSync } from "node:fs"

type Ev = {
  schema_version: 1
  ts: string
  task_id: string | null
  spawn_id: string | null
  agent: string | null
  event_type: string
  level: string
  payload: Record<string, unknown>
}

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error(
    "usage: bun run scripts/g3-analyze-events.ts <events.ndjson> [more.ndjson ...]",
  )
  process.exit(1)
}

const events: Ev[] = []
for (const path of args) {
  if (!existsSync(path)) {
    console.error(`skip: ${path} (not found)`)
    continue
  }
  const text = readFileSync(path, "utf8")
  for (const line of text.split("\n")) {
    const t = line.trim()
    if (!t) continue
    try {
      events.push(JSON.parse(t) as Ev)
    } catch (e) {
      console.error(`skip malformed line in ${path}: ${(e as Error).message}`)
    }
  }
}

if (events.length === 0) {
  console.error("no events parsed; aborting")
  process.exit(1)
}

console.log(`# G.3 events analysis — ${events.length} events from ${args.length} file(s)`)

// ─── 1. Spawn-latency histogram ─────────────────────────────────────────────

const BUCKETS: { name: string; max: number }[] = [
  { name: "0-1s", max: 1_000 },
  { name: "1-5s", max: 5_000 },
  { name: "5-30s", max: 30_000 },
  { name: "30s+", max: Infinity },
]

const latencies: number[] = []
for (const e of events) {
  if (e.event_type === "spawn.end") {
    const ms = (e.payload.elapsed_ms as number | undefined) ?? -1
    if (ms >= 0) latencies.push(ms)
  }
}
const counts = BUCKETS.map(() => 0)
for (const ms of latencies) {
  for (let i = 0; i < BUCKETS.length; i++) {
    if (ms <= BUCKETS[i]!.max) {
      counts[i]!++
      break
    }
  }
}

console.log(`\n## 1. Spawn-latency histogram (n=${latencies.length})`)
const max = Math.max(1, ...counts)
for (let i = 0; i < BUCKETS.length; i++) {
  const n = counts[i]!
  const bar = "█".repeat(Math.round((n / max) * 30))
  console.log(`  ${BUCKETS[i]!.name.padEnd(6)} ${String(n).padStart(3)}  ${bar}`)
}
const median =
  latencies.length === 0
    ? 0
    : [...latencies].sort((a, b) => a - b)[Math.floor(latencies.length / 2)]!
const sum = latencies.reduce((a, b) => a + b, 0)
console.log(
  `  median=${median}ms  mean=${Math.round(sum / Math.max(1, latencies.length))}ms  max=${Math.max(0, ...latencies)}ms`,
)

// ─── 2. LLM failure rate ────────────────────────────────────────────────────

let llmTotal = 0
let llmFail = 0
const failByClass: Record<string, number> = {}
for (const e of events) {
  if (e.event_type === "llm.response") {
    llmTotal++
    const outcome = e.payload.outcome as string
    if (outcome !== "success") {
      llmFail++
      const cls = (e.payload.error_class as string | undefined) ?? outcome
      failByClass[cls] = (failByClass[cls] ?? 0) + 1
    }
  }
}
const rate = llmTotal === 0 ? 0 : (llmFail / llmTotal) * 100
console.log(`\n## 2. LLM failure rate`)
console.log(`  total=${llmTotal}  failed=${llmFail}  rate=${rate.toFixed(1)}%`)
for (const [cls, n] of Object.entries(failByClass).sort(
  (a, b) => b[1] - a[1],
)) {
  console.log(`    ${cls}: ${n}`)
}

// ─── 3. Verdict distribution ────────────────────────────────────────────────
//
// Verdicts are not directly emitted as event fields — the agents return
// them in `output`, and plan.ts logs them as `say` text only. The events
// we have do NOT include verdict in payload. Closest we can do from
// events alone is correlate spawn.end success per agent.

console.log(`\n## 3. Per-agent spawn outcomes`)
const perAgent: Record<string, { ok: number; fail: number }> = {}
for (const e of events) {
  if (e.event_type === "spawn.end" && e.agent) {
    const k = e.agent
    perAgent[k] ??= { ok: 0, fail: 0 }
    if (e.payload.outcome === "success") perAgent[k].ok++
    else perAgent[k].fail++
  }
}
for (const [agent, c] of Object.entries(perAgent).sort()) {
  const total = c.ok + c.fail
  console.log(
    `  ${agent.padEnd(28)} ${c.ok}/${total} success` +
      (c.fail > 0 ? ` (${c.fail} failed)` : ""),
  )
}

// ─── 4. Prompt-chars vs latency correlation ─────────────────────────────────

const pairs: { chars: number; ms: number }[] = []
const reqByCorr: Record<string, number> = {}
for (const e of events) {
  if (e.event_type === "llm.request" && e.spawn_id) {
    const c = e.payload.prompt_chars as number | undefined
    if (typeof c === "number") reqByCorr[e.spawn_id] = c
  }
}
for (const e of events) {
  if (e.event_type === "llm.response" && e.spawn_id) {
    const c = reqByCorr[e.spawn_id]
    const ms = e.payload.latency_ms as number | undefined
    if (typeof c === "number" && typeof ms === "number") {
      pairs.push({ chars: c, ms })
    }
  }
}

console.log(`\n## 4. Prompt-chars vs latency (n=${pairs.length})`)
if (pairs.length >= 2) {
  const meanX = pairs.reduce((a, p) => a + p.chars, 0) / pairs.length
  const meanY = pairs.reduce((a, p) => a + p.ms, 0) / pairs.length
  let num = 0
  let dxx = 0
  let dyy = 0
  for (const p of pairs) {
    const dx = p.chars - meanX
    const dy = p.ms - meanY
    num += dx * dy
    dxx += dx * dx
    dyy += dy * dy
  }
  const r = dxx === 0 || dyy === 0 ? 0 : num / Math.sqrt(dxx * dyy)
  console.log(
    `  mean_chars=${Math.round(meanX)}  mean_latency_ms=${Math.round(meanY)}  pearson_r=${r.toFixed(3)}`,
  )
  // Print sorted scatter for human inspection.
  for (const p of [...pairs].sort((a, b) => a.chars - b.chars)) {
    console.log(`    chars=${String(p.chars).padStart(5)}  ms=${p.ms}`)
  }
} else {
  console.log("  insufficient paired llm.request/llm.response data")
}
