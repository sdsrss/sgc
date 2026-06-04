// `sgc metrics` — four-化 product self-scorecard (Phase 3).
//
// Read-only; no LLM, no agent spawn, no events (same nature as reflect). The
// dispatcher logic lives at src/dispatcher/metrics.ts; this file is CLI glue.
// Spec: docs/superpowers/specs/2026-06-04-four-hua-metrics-design.md.

import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  computeMetricsLive,
  computeRuntimeMetrics,
  formatScorecard,
  serializeBaseline,
} from "../dispatcher/metrics"

export interface MetricsCliOptions {
  json?: boolean
  writeBaseline?: boolean
  /** Override repo root (tests + --write-baseline). Default: derived from import.meta. */
  repoRoot?: string
}

const moduleDir = dirname(fileURLToPath(import.meta.url))
const defaultRoot = resolve(moduleDir, "..", "..")

export async function runMetrics(opts: MetricsCliOptions = {}): Promise<void> {
  const root = opts.repoRoot ?? defaultRoot
  if (opts.writeBaseline) {
    const live = computeMetricsLive(root)
    const path = resolve(root, "metrics", "metrics-baseline.yaml")
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, serializeBaseline(live), "utf8")
    console.error(`wrote: ${path}`)
    return
  }
  // With an explicit repoRoot (tests / dev), compute live from on-disk sources;
  // otherwise compute from the embedded/compiled product (real runtime).
  const m = opts.repoRoot ? computeMetricsLive(root) : computeRuntimeMetrics()
  console.log(opts.json ? JSON.stringify(m, null, 2) : formatScorecard(m))
}
