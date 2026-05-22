// CE-5 (f6) — `sgc loop` CLI handler. Thin operator-facing wrapper
// around the orchestrator at src/dispatcher/loop.ts.

import {
  runLoop,
  listLoopRuns,
  showLoopRun,
  type LoopOptions,
  type LoopResult,
  type LoopRun,
} from "../dispatcher/loop"

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
    case "paused_ship":
      return `\nnext: run \`sgc ship${r.run.level === "L3" ? " --signed-by <id>" : ""}\`, then \`sgc loop --resume ${id}\` to continue.`
    case "failed":
      return `\nnext: fix the underlying issue, then \`sgc loop --resume ${id}\` to retry the failed step (${r.run.failed_step}).`
    case "complete":
      return `\nrun complete. All 6 steps done.`
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
  if (!cliOpts.resume && !cliOpts.task) {
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
