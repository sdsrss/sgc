#!/usr/bin/env bun
//
// sgc — unified engineering agent CLI.
//
// 8 subcommands per docs/c-phase-dispatcher.md. C-phase MVP implements
// only `status` (read-only). Other commands print a NotImplementedYet
// message; full implementation lands in subsequent C-phase commits.
//
// State layer is rooted at `.sgc/` in the project (override via
// SGC_STATE_ROOT). Contracts (capabilities, state schema) live at
// <package>/contracts/ (override via SGC_CONTRACTS_DIR).

import { defineCommand, runMain } from "citty"
import { existsSync } from "node:fs"
import packageJson from "../package.json"

class NotImplementedYet extends Error {
  constructor(cmd: string) {
    super(
      `'sgc ${cmd}' is not yet implemented in the C-phase MVP.\n` +
        `Implemented: status.\n` +
        `Roadmap: see docs/c-phase-dispatcher.md.`,
    )
    this.name = "NotImplementedYet"
  }
}

// ── unimplemented stubs ────────────────────────────────────────────────────

const discover = defineCommand({
  meta: { name: "discover", description: "Clarify requirements before planning" },
  args: {
    topic: { type: "positional", required: false, description: "What to clarify" },
  },
  run() {
    throw new NotImplementedYet("discover")
  },
})

const plan = defineCommand({
  meta: { name: "plan", description: "Classify task level, run planners, write intent" },
  args: {
    task: {
      type: "positional",
      required: true,
      description: "Task description (one sentence)",
    },
    level: {
      type: "string",
      required: false,
      description: "Override classifier level (upgrade only — L1→L2, L2→L3)",
    },
    "signed-by": {
      type: "string",
      required: false,
      description: "Human signer_id required for L3 intents (Invariant §4)",
    },
    motivation: {
      type: "string",
      required: false,
      description: "Long-form rationale (≥20 words; required for L1+ if task description is short)",
    },
  },
  async run({ args }) {
    const { runPlan } = await import("./commands/plan")
    const force = args.level as "L0" | "L1" | "L2" | "L3" | undefined
    const signedBy = args["signed-by"] as string | undefined
    const userSignature = signedBy
      ? { signed_at: new Date().toISOString(), signer_id: signedBy }
      : undefined
    await runPlan(args.task as string, {
      forceLevel: force,
      userSignature,
      motivation: args.motivation as string | undefined,
    })
  },
})

const work = defineCommand({
  meta: { name: "work", description: "Track feature-list progress for the active task" },
  args: {
    add: {
      type: "string",
      required: false,
      description: "Append a new feature to feature-list with this title",
    },
    done: {
      type: "string",
      required: false,
      description: "Mark feature with this id as done",
    },
  },
  async run({ args }) {
    const { runWork } = await import("./commands/work")
    await runWork({
      add: args.add as string | undefined,
      done: args.done as string | undefined,
    })
  },
})

const review = defineCommand({
  meta: { name: "review", description: "Independent static review of the diff" },
  args: {
    base: {
      type: "string",
      required: false,
      description: "Git ref to diff against (default: HEAD)",
    },
  },
  async run({ args }) {
    const { runReview } = await import("./commands/review")
    await runReview({ base: args.base as string | undefined })
  },
})

const qa = defineCommand({
  meta: { name: "qa", description: "Real-browser end-to-end QA via the browse module" },
  args: {
    target: { type: "positional", required: false, description: "URL or local path" },
  },
  run() {
    throw new NotImplementedYet("qa")
  },
})

const ship = defineCommand({
  meta: { name: "ship", description: "Ship gate: verify evidence + trigger compound decision" },
  run() {
    throw new NotImplementedYet("ship")
  },
})

const compound = defineCommand({
  meta: {
    name: "compound",
    description: "Extract and store knowledge into solutions/ (usually janitor-triggered)",
  },
  run() {
    throw new NotImplementedYet("compound")
  },
})

// ── status (implemented) ───────────────────────────────────────────────────

const status = defineCommand({
  meta: {
    name: "status",
    description: "Show current task state, decisions history, and knowledge stats",
  },
  async run() {
    const { readCurrentTask } = await import("./dispatcher/state")
    const stateRoot = process.env["SGC_STATE_ROOT"] ?? ".sgc"

    if (!existsSync(stateRoot)) {
      console.log(`No .sgc/ state directory at ${stateRoot}.`)
      console.log(`Run 'sgc plan <task>' to start your first task.`)
      return
    }

    const ct = readCurrentTask(stateRoot)
    if (!ct) {
      console.log(`State directory exists at ${stateRoot} but no active task.`)
      console.log(`Run 'sgc plan <task>' to begin one.`)
      return
    }

    const rows: [string, string][] = [
      ["task_id", ct.task.task_id],
      ["level", ct.task.level],
      ["active_feature", ct.task.active_feature ?? "(none)"],
      ["session_start", ct.task.session_start],
      ["last_activity", ct.task.last_activity],
    ]
    const labelW = Math.max(...rows.map(([k]) => k.length))
    console.log(`Active task (state root: ${stateRoot}):`)
    for (const [k, v] of rows) {
      console.log(`  ${k.padEnd(labelW)}  ${v}`)
    }
  },
})

// ── main ────────────────────────────────────────────────────────────────────

const main = defineCommand({
  meta: {
    name: "sgc",
    version: packageJson.version,
    description:
      "SGC — engineering agent: plan, execute, review, QA, ship, and compound knowledge",
  },
  subCommands: {
    discover: () => discover,
    plan: () => plan,
    work: () => work,
    review: () => review,
    qa: () => qa,
    ship: () => ship,
    compound: () => compound,
    status: () => status,
  },
})

runMain(main)
