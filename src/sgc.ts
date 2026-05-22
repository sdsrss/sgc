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

const discover = defineCommand({
  meta: { name: "discover", description: "Clarify requirements before planning" },
  args: {
    topic: { type: "positional", required: true, description: "What to clarify" },
  },
  async run({ args }) {
    const { runDiscover } = await import("./commands/discover")
    await runDiscover({ topic: args.topic as string })
  },
})

const plan = defineCommand({
  meta: { name: "plan", description: "Classify task level, run planners, write intent" },
  args: {
    task: {
      type: "positional",
      required: false,
      description: "Task description (one sentence) — required unless --jobs or --status is set",
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
    auto: {
      type: "boolean",
      required: false,
      description: "Skip interactive confirmation. REFUSED at L3 (Invariant §4).",
    },
    "force-new-task": {
      type: "boolean",
      required: false,
      description: "Override active handoff and start a new task",
    },
    async: {
      type: "boolean",
      required: false,
      description:
        "CE-4: fork a detached child running the planner cluster; print job_id and exit. Tail with `sgc plan --status <id>`.",
    },
    jobs: {
      type: "boolean",
      required: false,
      description: "List async plan jobs (running, done, failed, stale). No TASK arg needed.",
    },
    status: {
      type: "string",
      required: false,
      description: "Show one async plan job by id (frontmatter + tail log). No TASK arg needed.",
    },
    log: {
      type: "boolean",
      required: false,
      description: "With --status: print the entire log file instead of the last 100 lines.",
    },
  },
  async run({ args }) {
    const showJobsFlag = args.jobs as boolean | undefined
    const showStatusId = args.status as string | undefined
    const showLog = args.log as boolean | undefined

    if (showJobsFlag) {
      const { listJobs } = await import("./dispatcher/plan-jobs")
      const jobs = await listJobs()
      if (jobs.length === 0) {
        process.stderr.write("no plan jobs found.\n")
        return
      }
      for (const j of jobs) {
        process.stdout.write(
          `${j.job_id}  ${j.status.padEnd(7)}  pid=${String(j.pid).padEnd(7)}  started=${j.started_at}  task=${j.task}\n`,
        )
      }
      return
    }

    if (showStatusId !== undefined && showStatusId.length > 0) {
      const { showJob } = await import("./dispatcher/plan-jobs")
      const r = await showJob(showStatusId, {
        logTailLines: showLog ? Number.MAX_SAFE_INTEGER : 100,
      })
      const j = r.job
      process.stdout.write(`job_id:       ${j.job_id}\n`)
      process.stdout.write(`task:         ${j.task}\n`)
      process.stdout.write(`status:       ${j.status}\n`)
      process.stdout.write(`pid:          ${j.pid}\n`)
      process.stdout.write(`started_at:   ${j.started_at}\n`)
      if (j.completed_at) process.stdout.write(`completed_at: ${j.completed_at}\n`)
      if (j.level) process.stdout.write(`level:        ${j.level}\n`)
      if (j.task_id) process.stdout.write(`task_id:      ${j.task_id}\n`)
      if (j.intent_path) process.stdout.write(`intent_path:  ${j.intent_path}\n`)
      if (j.error) process.stdout.write(`error:        ${j.error}\n`)
      process.stdout.write(`log_path:     ${j.log_path}\n`)
      process.stdout.write(`\n--- log${showLog ? "" : " (tail 100)"} ---\n`)
      process.stdout.write(r.logTail)
      return
    }

    const task = args.task as string | undefined
    if (!task) {
      process.stderr.write(
        "error: TASK arg required (unless --jobs or --status <id> is set)\n",
      )
      process.exit(1)
    }
    const { runPlan } = await import("./commands/plan")
    const force = args.level as "L0" | "L1" | "L2" | "L3" | undefined
    const signedBy = args["signed-by"] as string | undefined
    const userSignature = signedBy
      ? { signed_at: new Date().toISOString(), signer_id: signedBy }
      : undefined
    await runPlan(task, {
      forceLevel: force,
      userSignature,
      motivation: args.motivation as string | undefined,
      autoConfirm: args.auto as boolean | undefined,
      forceNewTask: args["force-new-task"] as boolean | undefined,
      async: args.async as boolean | undefined,
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
    "append-as": {
      type: "string",
      required: false,
      description:
        "Follow-up suffix — write reports to <reviewer>.<suffix>.md instead of <reviewer>.md (F-5)",
    },
  },
  async run({ args }) {
    const { runReview } = await import("./commands/review")
    await runReview({
      base: args.base as string | undefined,
      appendAs: args["append-as"] as string | undefined,
    })
  },
})

const qa = defineCommand({
  meta: {
    name: "qa",
    description: "Real-browser end-to-end QA via the browse module",
  },
  args: {
    target: {
      type: "positional",
      required: false,
      description: "URL or local path to test (e.g. http://localhost:3000)",
    },
    flows: {
      type: "string",
      required: false,
      description:
        "Comma-separated user flow descriptions (e.g. 'login,dashboard-load,logout')",
    },
  },
  async run({ args }) {
    const { runQa } = await import("./commands/qa")
    await runQa({
      target: args.target as string | undefined,
      flows: args.flows
        ? String(args.flows)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
    })
  },
})

const ship = defineCommand({
  meta: {
    name: "ship",
    description:
      "Ship gate: verify evidence (reviews, qa, feature-list) and write ship.md",
  },
  args: {
    auto: {
      type: "boolean",
      required: false,
      description: "Skip interactive confirmation. REFUSED at L3 (Invariant §4).",
    },
    pr: {
      type: "boolean",
      required: false,
      description: "Create a GitHub PR via `gh pr create` after writing ship.md",
    },
    "pr-title": {
      type: "string",
      required: false,
      description: "PR title override (default: 'sgc ship: <intent.title>')",
    },
    "pr-body": {
      type: "string",
      required: false,
      description: "PR body override (default: auto-generated summary)",
    },
    "janitor-skip-reason": {
      type: "string",
      required: false,
      description:
        "Opt out of janitor.compound invocation. Writes a synthetic skip decision (reason_code=user_opt_out) with your ≥40-char justification. Required field — there is no silent-skip flag (Invariant §6).",
    },
    "force-compound": {
      type: "boolean",
      required: false,
      description:
        "Force janitor.compound to decide 'compound' (bypass decision_rules). Also bypasses dedup inside runCompound.",
    },
  },
  async run({ args }) {
    const { runShip } = await import("./commands/ship")
    await runShip({
      autoConfirm: args.auto as boolean | undefined,
      createPr: args.pr as boolean | undefined,
      prTitle: args["pr-title"] as string | undefined,
      prBody: args["pr-body"] as string | undefined,
      janitorSkipReason: args["janitor-skip-reason"] as string | undefined,
      forceCompound: args["force-compound"] as boolean | undefined,
    })
  },
})

const compound = defineCommand({
  meta: {
    name: "compound",
    description: "Extract and store knowledge into solutions/ (usually janitor-triggered)",
  },
  args: {
    force: {
      type: "boolean",
      required: false,
      description: "Bypass dedup threshold; force a new write even if similarity ≥ 0.85",
    },
    slug: {
      type: "string",
      required: false,
      description: "Override the solution filename slug (default: slugify(problem_summary))",
    },
    "from-ship-failure": {
      type: "string",
      required: false,
      description:
        "CE-3 promote: convert a captured ship-failure record into a solutions/ entry. Pass the slug under <stateRoot>/ship-failures/<slug>.md.",
    },
    "solution-slug": {
      type: "string",
      required: false,
      description:
        "Override the solution slug when promoting (default: ship-failure-<short-sha>). Only valid alongside --from-ship-failure.",
    },
  },
  async run({ args }) {
    const fromShipFailure = args["from-ship-failure"] as string | undefined
    if (fromShipFailure !== undefined && fromShipFailure.length > 0) {
      const { runCompoundPromote } = await import("./commands/compound")
      const result = await runCompoundPromote({
        slug: fromShipFailure,
        force: args.force as boolean | undefined,
        solutionSlug: args["solution-slug"] as string | undefined,
      })
      process.stderr.write(
        `promote: action=${result.dedupAction} solution=${result.solutionPath} ship-failure=${result.shipFailurePath}\n`,
      )
      return
    }
    const { runCompound } = await import("./commands/compound")
    await runCompound({
      force: args.force as boolean | undefined,
      slug: args.slug as string | undefined,
    })
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

// ── tail (G.1.b) ──────────────────────────────────────────────────────────

const tail = defineCommand({
  meta: {
    name: "tail",
    description: "Tail .sgc/progress/events.ndjson (structured event stream)",
  },
  args: {
    task: { type: "string", description: "Filter by task_id (exact match)" },
    agent: {
      type: "string",
      description: "Glob-match agent name (e.g. planner.* or reviewer.correctness)",
    },
    "event-type": {
      type: "string",
      description: "Substring filter on event_type (e.g. spawn. or llm.)",
    },
    since: {
      type: "string",
      description: "ISO 8601 timestamp; only events at/after this moment",
    },
    follow: {
      type: "boolean",
      default: false,
      description: "Tail -f behavior: poll for new events as they land",
    },
    json: {
      type: "boolean",
      default: false,
      description: "Emit raw NDJSON (default is human-readable)",
    },
    limit: {
      type: "string",
      description:
        "Emit only the last N matching events on initial drain (post-filter). In --follow mode applies to the initial drain only, then streams unbounded.",
    },
  },
  async run({ args }) {
    const { runTail } = await import("./commands/tail")
    const limitRaw = args.limit as string | undefined
    let limit: number | undefined
    if (limitRaw !== undefined) {
      const n = Number.parseInt(limitRaw, 10)
      if (!Number.isFinite(n) || n < 0) {
        throw new Error(`--limit must be a non-negative integer; got ${limitRaw}`)
      }
      limit = n
    }
    await runTail({
      task: args.task as string | undefined,
      agent: args.agent as string | undefined,
      eventType: args["event-type"] as string | undefined,
      since: args.since as string | undefined,
      follow: args.follow as boolean,
      json: args.json as boolean,
      limit,
    })
  },
})

// ── agent-loop (D-1.1) ─────────────────────────────────────────────────────

const agentLoop = defineCommand({
  meta: {
    name: "agent-loop",
    description:
      "Helper for external actors (Claude main session, user) to fulfill pending agent spawns",
  },
  args: {
    list: {
      type: "boolean",
      required: false,
      description: "List all spawns with [x]/[ ] status markers",
    },
    show: {
      type: "string",
      required: false,
      description: "Print the prompt file for a given spawn_id",
    },
    submit: {
      type: "string",
      required: false,
      description: "Write the result file for a given spawn_id",
    },
    from: {
      type: "string",
      required: false,
      description: "With --submit: read YAML from this file (else from stdin)",
    },
  },
  async run({ args }) {
    const { runAgentLoop } = await import("./commands/agent-loop")
    await runAgentLoop({
      list: args.list as boolean | undefined,
      show: args.show as string | undefined,
      submit: args.submit as string | undefined,
      fromFile: args.from as string | undefined,
    })
  },
})

// ── doctor (P9) ────────────────────────────────────────────────────────────

const doctor = defineCommand({
  meta: {
    name: "doctor",
    description:
      "Consistency check across contracts/sgc-capabilities.yaml ↔ prompts/ ↔ slot-only annotations. Exit 1 on any failure.",
  },
  async run() {
    const { runDoctor } = await import("./commands/doctor")
    const report = await runDoctor()
    if (report.fail > 0) process.exit(1)
  },
})

// ── reflect (CE-2 f3) ──────────────────────────────────────────────────────

const reflect = defineCommand({
  meta: {
    name: "reflect",
    description: "Audit decisions against accumulated preventions (read-only, heuristic-only)",
  },
  args: {
    task: {
      type: "string",
      required: false,
      description: "Audit only this task_id (default: all decisions/)",
    },
    since: {
      type: "string",
      required: false,
      description: "YYYY-MM-DD; audit only decisions created on or after this date",
    },
    save: {
      type: "boolean",
      required: false,
      description: "Write each report to <stateRoot>/reflections/<task_id>.md (replace semantics)",
    },
    json: {
      type: "boolean",
      required: false,
      description: "Emit JSON ReflectReport[] (default: human-readable)",
    },
  },
  async run({ args }) {
    const { runReflect } = await import("./commands/reflect")
    await runReflect({
      task: args.task as string | undefined,
      since: args.since as string | undefined,
      save: args.save as boolean | undefined,
      json: args.json as boolean | undefined,
    })
  },
})

// ── watch-ci-failure (CE-3 f4) ─────────────────────────────────────────────

const watchCiFailure = defineCommand({
  meta: {
    name: "watch-ci-failure",
    description:
      "Poll the publish CI workflow for the current branch's HEAD and capture failures as ship-failure seed records",
  },
  args: {
    workflow: {
      type: "string",
      required: false,
      description: "Workflow filename (default: publish.yml)",
    },
    branch: {
      type: "string",
      required: false,
      description: "Branch to watch (default: current git branch)",
    },
    "run-id": {
      type: "string",
      required: false,
      description: "Attach directly to a specific gh run id; skips discovery polling",
    },
    interval: {
      type: "string",
      required: false,
      description: "Polling interval seconds (default: 15; clamped to [5, 60])",
    },
    timeout: {
      type: "string",
      required: false,
      description: "Total timeout seconds (default: 600; clamped to [60, 1800])",
    },
  },
  async run({ args }) {
    const { runWatchCiFailure } = await import("./commands/watch-ci-failure")
    const parseSec = (key: string): number | undefined => {
      const v = args[key] as string | undefined
      if (v === undefined) return undefined
      const n = Number.parseInt(v, 10)
      if (!Number.isFinite(n) || n < 1) {
        throw new Error(`--${key} must be a positive integer; got ${v}`)
      }
      return n
    }
    await runWatchCiFailure({
      workflow: args.workflow as string | undefined,
      branch: args.branch as string | undefined,
      runId: args["run-id"] as string | undefined,
      intervalSec: parseSec("interval"),
      timeoutSec: parseSec("timeout"),
    })
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
    reflect: () => reflect,
    "watch-ci-failure": () => watchCiFailure,
    status: () => status,
    "agent-loop": () => agentLoop,
    tail: () => tail,
    doctor: () => doctor,
  },
})

runMain(main)
