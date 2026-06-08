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
  resolveStateRoot,
  writeCurrentTask,
  writeFeatureList,
  writeRedGreenCapture,
} from "../dispatcher/state"
import type { Feature, FeatureList } from "../dispatcher/types"
import { createLogger, type Logger } from "../dispatcher/logger"
import { withFileLock } from "../dispatcher/file-lock"
import { join } from "node:path"

export interface WorkOptions {
  stateRoot?: string
  add?: string
  done?: string
  /**
   * Verification close-gate (sp:verification-before-completion absorb, Tier 1).
   * Required to transition a feature to `done` — arbitrary non-empty string
   * naming how it was verified. OPERATOR RESPONSIBILITY: sgc records it but
   * does NOT execute it (parity with `sgc debug close`). Not required when
   * `--done` targets an already-done feature (grandfathered no-op).
   */
  verifyCommand?: string
  /** Optional free-text evidence naming what was observed (Iron Law #2). */
  evidence?: string
  /** TDD-ledger: prior-RED identifier (failing test / repro). Pairs with redOutput. */
  priorRed?: string
  /** TDD-ledger: observed failure output of the prior-RED. Pairs with priorRed. */
  redOutput?: string
  /** TDD-ledger: reason for closing without a prior-RED (escape hatch). */
  waiveRed?: string
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
  const done = new Set(list.features.filter((f) => f.status === "done").map((f) => f.id))
  const depsMet = (f: { depends_on?: string[] }) => (f.depends_on ?? []).every((d) => done.has(d))
  const inProgress = list.features.find((f) => f.status === "in_progress" && depsMet(f))
  if (inProgress) return inProgress.id
  const pending = list.features.find((f) => f.status === "pending" && depsMet(f))
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
    let meta = ""
    if (f.files) {
      const n = f.files.create.length + f.files.modify.length + f.files.test.length
      meta += ` — ${n} file${n === 1 ? "" : "s"}`
    }
    if (f.steps && f.steps.length > 0) {
      meta += `${f.files ? "," : " —"} ${f.steps.length} step${f.steps.length === 1 ? "" : "s"}`
    }
    log(`  ${marker} ${f.id}: ${f.title}${status}${meta}`)
  }
}

export async function runWork(opts: WorkOptions = {}): Promise<WorkResult> {
  // Serialize the mutating paths (--add / --done): each is a read-modify-write
  // of feature-list (and current-task), and writeAtomic only makes each
  // individual write atomic — two concurrent `work --add` both read the same
  // base list, append one feature each, and the second write clobbers the
  // first (silent lost update). A read-only `sgc work` (listing) needs no lock.
  if (opts.add || opts.done) {
    const root = resolveStateRoot(opts.stateRoot)
    return withFileLock(join(root, ".work.lock"), () => runWorkUnlocked(opts))
  }
  return runWorkUnlocked(opts)
}

async function runWorkUnlocked(opts: WorkOptions = {}): Promise<WorkResult> {
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
      // Grandfather: already-done features are a no-op and need no gate.
      log(`feature ${opts.done} was already done; no change`)
    } else {
      // Verification close-gate (Tier 1, parity with `sgc debug close` Iron
      // Law #3): a new done-transition MUST carry a verify_command. sgc records
      // it but does not execute it — operator responsibility.
      const verifyCommand = opts.verifyCommand?.trim()
      if (!verifyCommand) {
        throw new Error(
          `done refused: --verify-command required to mark ${opts.done} done ` +
            `(operator responsibility; sgc does not execute it)`,
        )
      }
      // TDD-ledger close-gate (Phase 2a): require a recorded prior-RED pair
      // (--prior-red + --red-output) XOR --waive-red <reason>. sgc records the
      // attestation; it does not run the test.
      const priorRed = opts.priorRed?.trim()
      const redOutput = opts.redOutput?.trim()
      const waiveRed = opts.waiveRed?.trim()
      const hasPair = Boolean(priorRed) && Boolean(redOutput)
      if (Boolean(priorRed) !== Boolean(redOutput)) {
        throw new Error(
          `done refused: --prior-red and --red-output must be supplied together`,
        )
      }
      if (hasPair && waiveRed) {
        throw new Error(
          `done refused: supply a prior-RED pair OR --waive-red, not both (conflict)`,
        )
      }
      if (!hasPair && !waiveRed) {
        throw new Error(
          `done refused: record a prior-RED (--prior-red "<failing test>" ` +
            `--red-output "<observed failure>") or pass --waive-red "<reason>"`,
        )
      }
      const evidence = opts.evidence?.trim()
      list.features[idx] = {
        ...list.features[idx]!,
        status: "done",
        verify_command: verifyCommand,
        ...(evidence ? { evidence } : {}),
        ...(hasPair ? { prior_red: priorRed, red_output: redOutput } : {}),
        ...(waiveRed ? { waived_red: waiveRed } : {}),
      }
      writeFeatureList(list, "", stateRoot)
      log(`marked ${opts.done} done`)
      if (hasPair) {
        writeRedGreenCapture(
          {
            title: list.features[idx]!.title,
            task_id: ct.task.task_id,
            feature_id: opts.done,
            level: String(ct.task.level),
            prior_red: priorRed!,
            red_output: redOutput!,
            verify_command: verifyCommand,
            ...(evidence ? { evidence } : {}),
          },
          stateRoot,
        )
      }
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
    if (ct.task.level === "L0") {
      // L0 is fast-path: no intent.md is written, so review/qa/ship (which
      // require intent.md) cannot run. Guide to the actual L0 end-state.
      log(`L0 task complete (fast-path — review/qa/ship gates apply at L2+).`)
    } else {
      log(`All features done. Run \`sgc review\` for independent code review.`)
    }
  } else if (activeId) {
    const active = list.features.find((f) => f.id === activeId)!
    log(`Active: ${activeId} — ${active.title}`)
    log(`When implemented, run: \`sgc work --done ${activeId}\``)
  }

  const remaining = list.features.filter((f) => f.status !== "done")
  const active = activeId ? list.features.find((f) => f.id === activeId) ?? null : null
  return { remaining, active, allDone }
}
