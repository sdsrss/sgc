// src/commands/handoff.ts
//
// GS-2 (f9) — CLI handler for `sgc handoff --auto | --print <slug>`.
//
// Spec: tasks/specs/gs-2-handoff.md. Pure orchestration over
// gatherHandoffState / renderHandoffMarkdown / writeHandoffMarkdown
// + thin stdio routing. exitCode returned to caller (sgc.ts) which
// propagates to process.exit.

import { existsSync } from "node:fs"
import * as fs from "node:fs/promises"
import { join } from "node:path"
import {
  gatherHandoffState,
  renderHandoffMarkdown,
  writeHandoffMarkdown,
  type GitProbe,
} from "../dispatcher/handoff"
import { resolveStateRoot } from "../dispatcher/state"

export interface HandoffCliOptions {
  auto?: boolean
  print?: string
  stateRoot?: string
  repoRoot?: string
  now?: Date
  sgcVersion?: string
  gitProbe?: GitProbe
  stdoutWrite?: (s: string) => void
  stderrWrite?: (s: string) => void
}

export interface HandoffCliResult {
  exitCode: number
  writtenPath?: string
}

export async function runHandoff(opts: HandoffCliOptions): Promise<HandoffCliResult> {
  const repoRoot = opts.repoRoot ?? process.cwd()
  // State reads honor SGC_STATE_ROOT via the centralized resolver (explicit arg
  // → env → ".sgc") — same as every other command. Inlining `join(repoRoot,
  // ".sgc")` here silently bypassed the env var and leaked an unrelated repo's
  // active task into the handoff. `repoRoot` stays the output root for the
  // tasks/<slug>-paused.md file + the git probe (repo concerns, not state).
  const stateRoot = resolveStateRoot(opts.stateRoot)
  const stdout = opts.stdoutWrite ?? ((s: string) => process.stdout.write(s))
  const stderr = opts.stderrWrite ?? ((s: string) => process.stderr.write(s))

  // --print <slug> is the only alternate mode; bare `sgc handoff` (and the
  // explicit --auto) both run the checkpoint, so --auto is optional as the
  // README documents (`sgc handoff [--auto]`).
  if (typeof opts.print === "string" && opts.print.length > 0) {
    const target = join(repoRoot, "tasks", `${opts.print}-paused.md`)
    if (!existsSync(target)) {
      stderr(`no paused.md for slug ${opts.print}\n`)
      return { exitCode: 1 }
    }
    const text = await fs.readFile(target, "utf-8")
    stdout(text)
    return { exitCode: 0 }
  }

  try {
    const snap = await gatherHandoffState(stateRoot, repoRoot, {
      now: opts.now,
      git: opts.gitProbe,
      sgcVersion: opts.sgcVersion,
    })
    const md = renderHandoffMarkdown(snap)
    const writtenPath = await writeHandoffMarkdown(repoRoot, snap.slug, md)
    stderr(`paused: ${writtenPath}\n`)
    return { exitCode: 0, writtenPath }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    stderr(`handoff failed: ${msg}\n`)
    return { exitCode: 1 }
  }
}
