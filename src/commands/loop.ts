// CE-5 (f6) — `sgc loop` CLI handler. Thin operator-facing wrapper
// around the orchestrator at src/dispatcher/loop.ts.

import {
  runLoop,
  listLoopRuns,
  showLoopRun,
  LoopError,
  type LoopOptions,
  type LoopResult,
  type LoopRun,
  type StepRunners,
} from "../dispatcher/loop"
import { intentPath, readCurrentTask } from "../dispatcher/state"
import { runPlan } from "./plan"
import { runReview } from "./review"
import { runQa } from "./qa"
import { runCompound } from "./compound"

export interface LoopCliOptions {
  task?: string
  resume?: string
  runs?: boolean
  status?: string
  motivation?: string
  forceLevel?: "L0" | "L1" | "L2" | "L3"
  signedBy?: string
  stateRoot?: string
}

function renderRunSummary(run: LoopRun): string {
  return [
    `run_id:          ${run.run_id}`,
    `task:            ${run.task}`,
    `status:          ${run.status}`,
    `current_step:    ${run.current_step}`,
    `started_at:      ${run.started_at}`,
    `last_updated_at: ${run.last_updated_at}`,
    run.task_id ? `task_id:         ${run.task_id}` : null,
    run.level ? `level:           ${run.level}` : null,
    run.failed_step ? `failed_step:     ${run.failed_step}` : null,
    run.error ? `error:           ${run.error}` : null,
    "",
    "steps:",
    ...run.steps.map(
      (s) =>
        `  ${s.step.padEnd(9)} ${s.status.padEnd(11)} ${s.completed_at ?? s.started_at ?? ""}`,
    ),
  ]
    .filter((l): l is string => l !== null)
    .join("\n")
}

function renderTerminalHint(r: LoopResult): string {
  const id = r.run.run_id
  switch (r.terminal_reason) {
    case "paused_work":
      return `\nnext: implement the change, then \`sgc loop --resume ${id}\` to continue.`
    case "paused_qa":
      return `\nnext: run \`sgc qa <url> --flows <a,b>\` (or set SGC_QA_REAL=1 / --browse for a real-browser smoke), then \`sgc loop --resume ${id}\` to continue.`
    case "paused_ship":
      return `\nnext: run \`sgc ship${r.run.level === "L3" ? " --signed-by <id>" : ""}\`, then \`sgc loop --resume ${id}\` to continue.`
    case "failed":
      return `\nnext: fix the underlying issue, then \`sgc loop --resume ${id}\` to retry the failed step (${r.run.failed_step}).`
    case "complete":
      return `\nrun complete. All 6 steps done.`
  }
}

/**
 * Production step runners for `sgc loop`. C9/ARCH-2: this wiring lives in the
 * command layer and is injected into the orchestrator via opts.steps —
 * dispatcher/loop.ts is the lower layer and must not import commands/. Tests
 * inject their own StepRunners instead.
 */
export function defaultStepRunners(): Required<StepRunners> {
  return {
    plan: async (state, opts) => {
      try {
        const r = await runPlan(state.task, {
          stateRoot: opts.stateRoot,
          motivation: opts.motivation,
          userSignature: opts.userSignature,
          forceLevel: opts.forceLevel,
          // P3-4: an L3 classification reaches runPlan's interactive stdin gate
          // (Invariant §4). With a terminal attached that gate is correct and
          // runPlan's own reader handles it — so inject nothing. Without one
          // (CI, a detached run), the loop blocked on a prompt nobody would ever
          // answer: it looked like a hang, not like a decision waiting. Fail
          // fast instead, naming the command that CAN answer it.
          //
          // Deliberately NOT auto-confirming. §4's human gate at L3 is the whole
          // point; satisfying it because no human is present would invert it.
          ...(process.stdin.isTTY
            ? {}
            : {
                readConfirmation: async (): Promise<string> => {
                  throw new LoopError(
                    "L3NeedsConfirmation",
                    `task classified L3 — Invariant §4 requires a human confirmation at stdin, and ` +
                      `this loop has no terminal attached. Plan it by hand first:\n` +
                      `  sgc plan "${state.task}" --signed-by <you> --motivation "..."\n` +
                      `then resume: sgc loop --resume ${state.run_id}`,
                    { run_id: state.run_id, reason: "l3_needs_tty" },
                  )
                },
              }),
        })
        return {
          task_id: r.taskId,
          // The loop never forks async, so runPlan always returns a real level
          // here (the optional level is only absent on the async-parent path).
          level: r.level!,
          intent_path: r.intentPath,
        }
      } catch (e) {
        // runPlan refuses when a task is already active (the operator ran
        // `sgc plan` manually before `sgc loop`, or a prior loop attempt
        // planned). Without adoption the loop's plan step dead-ends: `--resume`
        // retries plan and hits the same guard forever. Adopt the active task
        // instead so `discover → plan → loop` and a retried loop both proceed.
        // Only intercept the active-task refusal — other plan failures (LLM
        // errors, schema gates) still propagate. The loop pauses at the work
        // gate next, so the operator sees the adopted task_id and can abort.
        const msg = e instanceof Error ? e.message : String(e)
        const existing = /active task/i.test(msg) ? readCurrentTask(opts.stateRoot) : null
        if (!existing) throw e
        const t = existing.task
        console.error(
          `loop: adopting active task ${t.task_id} (level ${t.level}) — already planned, not re-planning`,
        )
        return {
          task_id: t.task_id,
          level: String(t.level),
          intent_path:
            t.level === "L0"
              ? "(L0 — no intent.md)"
              : intentPath(t.task_id, opts.stateRoot),
        }
      }
    },
    review: async (_state, opts) => {
      await runReview({ stateRoot: opts.stateRoot })
    },
    qa: async (_state, opts) => {
      await runQa({ stateRoot: opts.stateRoot })
    },
    compound: async (_state, opts) => {
      await runCompound({ stateRoot: opts.stateRoot })
    },
  }
}

export async function runLoopCommand(
  cliOpts: LoopCliOptions,
): Promise<void> {
  // --runs: list view
  if (cliOpts.runs) {
    const runs = await listLoopRuns({ stateRoot: cliOpts.stateRoot })
    if (runs.length === 0) {
      process.stderr.write("no loop runs found.\n")
      return
    }
    for (const r of runs) {
      process.stdout.write(
        `${r.run_id}  ${r.status.padEnd(8)}  step=${r.current_step.padEnd(9)}  started=${r.started_at}  task=${r.task}\n`,
      )
    }
    return
  }

  // --status <id>: detailed view
  if (cliOpts.status !== undefined && cliOpts.status.length > 0) {
    const run = await showLoopRun(cliOpts.status, {
      stateRoot: cliOpts.stateRoot,
    })
    process.stdout.write(renderRunSummary(run) + "\n")
    return
  }

  // Run or resume.
  const opts: LoopOptions = {
    // C9/ARCH-2: the command layer supplies the production runners.
    steps: defaultStepRunners(),
    stateRoot: cliOpts.stateRoot,
    resume: cliOpts.resume,
    motivation: cliOpts.motivation,
    forceLevel: cliOpts.forceLevel,
    userSignature: cliOpts.signedBy
      ? {
          signed_at: new Date().toISOString(),
          signer_id: cliOpts.signedBy,
        }
      : undefined,
  }
  if (!cliOpts.resume && (!cliOpts.task || cliOpts.task.trim().length === 0)) {
    process.stderr.write(
      "error: TASK arg required (unless --resume <id>, --runs, or --status <id> is set)\n",
    )
    process.exit(1)
  }
  const result = await runLoop(cliOpts.resume ? null : cliOpts.task!, opts)
  process.stderr.write(renderRunSummary(result.run) + "\n")
  process.stderr.write(renderTerminalHint(result) + "\n")
  if (result.terminal_reason === "failed") {
    process.exit(1)
  }
}
