// `sgc work` command implementation.
//
// Pure state tracker — no agent dispatch, no LLM. The actual code-writing
// happens externally (Claude main session, the user, etc.). Three uses:
//
//   sgc work                    list features, highlight active one
//   sgc work --add "<title>"    append a feature to feature-list
//   sgc work --done <feature_id>  mark feature done; advance to next
//
// When all features are done, prints "next: sgc review".

import {
  readCurrentTask,
  readFeatureList,
  writeCurrentTask,
  writeFeatureList,
} from "../dispatcher/state"
import type { Feature, FeatureList } from "../dispatcher/types"
import { createLogger, type Logger } from "../dispatcher/logger"

export interface WorkOptions {
  stateRoot?: string
  add?: string
  done?: string
  log?: (msg: string) => void
  logger?: Logger
}

export interface WorkResult {
  remaining: Feature[]
  active: Feature | null
  allDone: boolean
}

function nowIso(): string {
  return new Date().toISOString()
}

function nextActiveId(list: FeatureList): string | null {
  // Prefer in_progress; else first pending.
  const inProgress = list.features.find((f) => f.status === "in_progress")
  if (inProgress) return inProgress.id
  const pending = list.features.find((f) => f.status === "pending")
  return pending ? pending.id : null
}

function printList(log: (m: string) => void, list: FeatureList, activeId: string | null): void {
  if (list.features.length === 0) {
    log("(feature list is empty — use `sgc work --add \"<title>\"` to add one)")
    return
  }
  for (const f of list.features) {
    const marker = f.status === "done" ? "[x]" : f.id === activeId ? "[>]" : "[ ]"
    const status = f.status === "done" ? "" : ` (${f.status})`
    log(`  ${marker} ${f.id}: ${f.title}${status}`)
  }
}

export async function runWork(opts: WorkOptions = {}): Promise<WorkResult> {
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot, say: opts.log })
  const log = (m: string) => logger.say(m)
  const stateRoot = opts.stateRoot

  const ct = readCurrentTask(stateRoot)
  if (!ct) {
    throw new Error("no active task — run `sgc plan <task>` first")
  }
  const flRead = readFeatureList(stateRoot)
  if (!flRead) {
    throw new Error("no feature-list.md — was the plan complete?")
  }
  let list = flRead.list

  // --add: append feature
  if (opts.add) {
    const nextId = `f${list.features.length + 1}`
    list = {
      features: [
        ...list.features,
        { id: nextId, title: opts.add, status: "pending" },
      ],
    }
    writeFeatureList(list, "", stateRoot)
    log(`added feature ${nextId}: ${opts.add}`)
  }

  // --done: mark feature done
  if (opts.done) {
    const idx = list.features.findIndex((f) => f.id === opts.done)
    if (idx === -1) {
      throw new Error(`feature ${opts.done} not found in feature-list`)
    }
    if (list.features[idx]!.status === "done") {
      log(`feature ${opts.done} was already done; no change`)
    } else {
      list.features[idx] = { ...list.features[idx]!, status: "done" }
      writeFeatureList(list, "", stateRoot)
      log(`marked ${opts.done} done`)
    }
  }

  // Compute new active feature
  const activeId = nextActiveId(list)
  const allDone = list.features.length > 0 && list.features.every((f) => f.status === "done")

  // Update current-task with new active + last_activity
  writeCurrentTask(
    {
      ...ct.task,
      active_feature: activeId ?? undefined,
      last_activity: nowIso(),
    },
    "",
    stateRoot,
  )

  // Print state
  log(`task ${ct.task.task_id} (level ${ct.task.level}):`)
  printList(log, list, activeId)
  log("")
  if (allDone) {
    log(`All features done. Run \`sgc review\` for independent code review.`)
  } else if (activeId) {
    const active = list.features.find((f) => f.id === activeId)!
    log(`Active: ${activeId} — ${active.title}`)
    log(`When implemented, run: \`sgc work --done ${activeId}\``)
  }

  const remaining = list.features.filter((f) => f.status !== "done")
  const active = activeId ? list.features.find((f) => f.id === activeId) ?? null : null
  return { remaining, active, allDone }
}
