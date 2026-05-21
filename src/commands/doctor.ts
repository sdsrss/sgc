// `sgc doctor` — consistency checks across the three name registries:
//
//   1. contracts/sgc-capabilities.yaml  (manifest, source-of-truth)
//   2. prompts/*.md                     (LLM templates referenced by prompt_path)
//   3. src/dispatcher/agents/*.ts       (implementations — heuristic + LLM coerce)
//
// Adding a new agent touches all three, and pre-spawn validation
// (spawn.ts:formatPrompt) only catches prompt_path mismatches at runtime,
// when a user has already typed `sgc plan ...`. `sgc doctor` runs the
// checks ahead of time — useful as a pre-PR hook and as a smoke test in
// CI.
//
// Checks:
//   (A) Every manifest with `prompt_path` declared → file exists in prompts/
//   (B) Every prompts/*.md file → at least one manifest references it
//   (C) status: slot-only entries → MUST have prompt_path: null (they are
//       documented placeholders, not LLM-routable)
//
// Exit code: 0 if zero failures, 1 otherwise. Warnings (orphan prompts)
// do not affect exit code — they signal "you may have stale template
// files" without blocking ship.

import { existsSync, readdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { getCapabilities } from "../dispatcher/schema"

const moduleDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(moduleDir, "..", "..")

type Severity = "ok" | "warn" | "fail"

interface CheckRow {
  severity: Severity
  msg: string
}

export interface DoctorOptions {
  log?: (msg: string) => void
  /** Override repo root for tests (default: derived from import.meta). */
  repoRoot?: string
}

export interface DoctorReport {
  ok: number
  warn: number
  fail: number
  rows: CheckRow[]
}

export async function runDoctor(opts: DoctorOptions = {}): Promise<DoctorReport> {
  const log = opts.log ?? ((m: string) => console.log(m))
  const root = opts.repoRoot ?? repoRoot

  const rows: CheckRow[] = []
  const emit = (row: CheckRow): void => {
    rows.push(row)
    log(row.msg)
  }

  const caps = getCapabilities()
  const manifests = Object.entries(caps.subagents)

  // ── (A) manifest.prompt_path → file exists ─────────────────────────────
  log("=== Manifest prompt_path ↔ prompts/ ===")
  for (const [name, m] of manifests) {
    if (m.prompt_path == null) continue
    const filePath = resolve(root, m.prompt_path)
    if (existsSync(filePath)) {
      emit({ severity: "ok", msg: `  ✓ ${name} → ${m.prompt_path}` })
    } else {
      emit({
        severity: "fail",
        msg: `  ✗ ${name} → ${m.prompt_path} (FILE MISSING)`,
      })
    }
  }

  // ── (B) prompts/*.md → referenced by some manifest ─────────────────────
  log("")
  log("=== prompts/ ↔ manifest ===")
  const promptsDir = resolve(root, "prompts")
  const declaredPrompts = new Set<string>()
  for (const [, m] of manifests) {
    if (m.prompt_path) declaredPrompts.add(m.prompt_path)
  }
  if (existsSync(promptsDir)) {
    for (const file of readdirSync(promptsDir).sort()) {
      if (!file.endsWith(".md")) continue
      const rel = `prompts/${file}`
      if (declaredPrompts.has(rel)) {
        emit({ severity: "ok", msg: `  ✓ ${rel}` })
      } else {
        emit({
          severity: "warn",
          msg: `  ⚠ ${rel} (orphan — no manifest references it)`,
        })
      }
    }
  }

  // ── (C) slot-only entries → prompt_path must be null/undefined ─────────
  log("")
  log("=== status: slot-only ↔ prompt_path: null ===")
  for (const [name, m] of manifests) {
    if (m.status !== "slot-only") continue
    if (m.prompt_path == null) {
      emit({
        severity: "ok",
        msg: `  ✓ ${name} (slot-only, no prompt_path)`,
      })
    } else {
      emit({
        severity: "fail",
        msg: `  ✗ ${name} (slot-only but declares prompt_path: ${m.prompt_path})`,
      })
    }
  }

  const ok = rows.filter((r) => r.severity === "ok").length
  const warn = rows.filter((r) => r.severity === "warn").length
  const fail = rows.filter((r) => r.severity === "fail").length

  log("")
  log(`=== Summary ===`)
  log(`${ok} OK · ${warn} warn · ${fail} fail`)

  return { ok, warn, fail, rows }
}
