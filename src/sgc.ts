#!/usr/bin/env bun
//
// sgc — self-contained engineering super-plugin CLI (citty).
//
// All-in-one, runs standalone (Node >= 18, no other plugins required); absorbs
// the plan / execute / review / QA / security / ship / compound-knowledge loop
// natively. Installed plugins (sp / gs / code-graph) are optional richer paths,
// surfaced as non-binding hints — never required (see dispatcher/delegation.ts).
//
// 20 subcommands spanning the L0→L3 pipeline + GS-N + the CE knowledge loop
// (17 mirrored as /sgc:* slash commands + 3 CLI-only: canary, watch-ci-failure,
// land). README.md is the authoritative command table; `sgc doctor` enforces
// slash↔CLI parity so this count stays honest.
//
// State layer is rooted at `.sgc/` in the project (override via
// SGC_STATE_ROOT). Contracts (capabilities, state schema) live at
// <package>/contracts/ (override via SGC_CONTRACTS_DIR).

import { defineCommand, runCommand, runMain, showUsage } from "citty"
import { existsSync } from "node:fs"
import packageJson from "../package.json"
import { debugCommand } from "./commands/debug"

const discover = defineCommand({
  meta: { name: "discover", description: "Clarify requirements before planning" },
  args: {
    topic: { type: "positional", required: true, description: "What to clarify" },
    template: {
      type: "string",
      required: false,
      description: "Framing overlay: product | scope | anti-pattern (GS-6)",
    },
  },
  async run({ args }) {
    const { runDiscover } = await import("./commands/discover")
    await runDiscover({
      topic: args.topic as string,
      ...(args.template ? { template: args.template as string } : {}),
    })
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
    deep: {
      type: "boolean",
      required: false,
      description: "Force deep decomposition at L1 (implied at L2/L3)",
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
      deep: args.deep as boolean | undefined,
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
      description: "Mark feature with this id as done (requires --verify-command)",
    },
    "verify-command": {
      type: "string",
      required: false,
      description:
        "(with --done) how the feature was verified — required to close. Operator responsibility; sgc does not execute it (parity with debug close)",
    },
    evidence: {
      type: "string",
      required: false,
      description: "(with --done) optional free-text evidence naming what was observed",
    },
    "prior-red": {
      type: "string",
      required: false,
      description:
        "(with --done) failing test / repro that was RED before the fix (TDD-ledger). Pairs with --red-output.",
    },
    "red-output": {
      type: "string",
      required: false,
      description: "(with --done) the observed failure output of --prior-red.",
    },
    "waive-red": {
      type: "string",
      required: false,
      description:
        "(with --done) close without a prior-RED, giving a reason (e.g. \"docs-only\"). Escape hatch for the TDD-ledger gate.",
    },
  },
  async run({ args }) {
    const { runWork } = await import("./commands/work")
    await runWork({
      add: args.add as string | undefined,
      done: args.done as string | undefined,
      verifyCommand: args["verify-command"] as string | undefined,
      evidence: args.evidence as string | undefined,
      priorRed: args["prior-red"] as string | undefined,
      redOutput: args["red-output"] as string | undefined,
      waiveRed: args["waive-red"] as string | undefined,
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
    description: "End-to-end QA gate (L2+ ship). Real-browser smoke (Playwright) is opt-in via --browse / SGC_QA_REAL=1; stub by default — returns concern, never rubber-stamps",
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
    browse: {
      type: "boolean",
      required: false,
      description:
        "Opt in to the real-browser smoke (Playwright); default is the non-rubber-stamping stub",
    },
  },
  async run({ args }) {
    const { runQa } = await import("./commands/qa")
    const result = await runQa({
      target: args.target as string | undefined,
      flows: args.flows
        ? String(args.flows)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
      browse: args.browse === true,
    })
    // Reflect the gate verdict in the exit code, mirroring `cso` and `review`:
    // a failed QA must be scriptable (`sgc qa ... && sgc ship`) and visible to
    // CI. `concern` stays exit 0 (advisory, never a rubber stamp).
    if (result.verdict === "fail") process.exit(1)
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
    "from-canary": {
      type: "string",
      required: false,
      description:
        "GS-1.1 promote: convert a captured canary-failure record into a solutions/ entry. Pass the slug under <stateRoot>/canaries/<slug>.md (e.g. 2026-05-25-c29f021-smoke_install).",
    },
    "from-red-green": {
      type: "string",
      required: false,
      description:
        "TDD-ledger promote: convert a captured red-green record into a solutions/ entry. Pass the slug under <stateRoot>/red-green/<slug>.md.",
    },
    "solution-slug": {
      type: "string",
      required: false,
      description:
        "Override the solution slug when promoting (default: ship-failure-<short-sha> for --from-ship-failure; canary-<short-sha>-<phase> for --from-canary). Only valid alongside a promote flag.",
    },
  },
  async run({ args }) {
    const fromCanary = args["from-canary"] as string | undefined
    if (fromCanary !== undefined && fromCanary.length > 0) {
      const { runCanaryPromote } = await import("./commands/compound")
      const result = await runCanaryPromote({
        slug: fromCanary,
        force: args.force as boolean | undefined,
        solutionSlug: args["solution-slug"] as string | undefined,
      })
      process.stderr.write(
        `promote: action=${result.dedupAction} solution=${result.solutionPath} canary=${result.canaryPath}\n`,
      )
      return
    }
    const fromRedGreen = args["from-red-green"] as string | undefined
    if (fromRedGreen !== undefined && fromRedGreen.length > 0) {
      const { runRedGreenPromote } = await import("./commands/compound")
      const result = await runRedGreenPromote({
        slug: fromRedGreen,
        force: args.force as boolean | undefined,
        solutionSlug: args["solution-slug"] as string | undefined,
      })
      process.stderr.write(
        `promote: action=${result.dedupAction} solution=${result.solutionPath} red-green=${result.shipFailurePath}\n`,
      )
      return
    }
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

// ── metrics (Phase 3 four-化) ──────────────────────────────────────────────

const metrics = defineCommand({
  meta: {
    name: "metrics",
    description: "Four-化 product self-scorecard (规范化/智能化/自动化/高效化), git-tracked, read-only",
  },
  args: {
    json: {
      type: "boolean",
      required: false,
      description: "Emit JSON FourHuaMetrics (default: human-readable scorecard)",
    },
    "write-baseline": {
      type: "boolean",
      required: false,
      description: "Recompute from sources and rewrite metrics/metrics-baseline.yaml (dev)",
    },
  },
  async run({ args }) {
    const { runMetrics } = await import("./commands/metrics")
    await runMetrics({
      json: args.json as boolean | undefined,
      writeBaseline: args["write-baseline"] as boolean | undefined,
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

// ── canary (GS-1 f8) ──────────────────────────────────────────────────────

const canary = defineCommand({
  meta: {
    name: "canary",
    description:
      "GS-1: post-publish health check — poll npm propagation, smoke install via npx, optional health-url GET. Failure writes a templated record under .sgc/canaries/ and exits 1.",
  },
  args: {
    package: {
      type: "string",
      required: false,
      description: "Package name (default: package.json `name` in cwd)",
    },
    version: {
      type: "string",
      required: false,
      description: "Expected version (default: package.json `version` → `git describe --tags --exact-match HEAD`)",
    },
    phases: {
      type: "string",
      required: false,
      description:
        "Comma-separated phases (default: npm_propagation,smoke_install); valid: npm_propagation, smoke_install, health_url",
    },
    "health-url": {
      type: "string",
      required: false,
      description: "Required when phases includes health_url. https?:// only.",
    },
    "health-regex": {
      type: "string",
      required: false,
      description: "On a 2xx response, body must match this regex.",
    },
    bin: {
      type: "string",
      required: false,
      description:
        "Bin name to invoke during smoke_install (default: derived from package name; @scope/foo → foo)",
    },
    interval: {
      type: "string",
      required: false,
      description: "Polling interval seconds (default: 15; clamped to [5, 60])",
    },
    timeout: {
      type: "string",
      required: false,
      description: "npm_propagation timeout seconds (default: 300; clamped to [60, 1800])",
    },
  },
  async run({ args }) {
    const { parsePhases, runCanary } = await import("./commands/canary")
    const parseSec = (key: string): number | undefined => {
      const v = args[key] as string | undefined
      if (v === undefined) return undefined
      const n = Number.parseInt(v, 10)
      if (!Number.isFinite(n) || n < 1) {
        throw new Error(`--${key} must be a positive integer; got ${v}`)
      }
      return n
    }
    await runCanary({
      packageName: args.package as string | undefined,
      expectedVersion: args.version as string | undefined,
      phases: parsePhases(args.phases as string | undefined),
      healthUrl: args["health-url"] as string | undefined,
      healthRegex: args["health-regex"] as string | undefined,
      binName: args.bin as string | undefined,
      intervalSec: parseSec("interval"),
      timeoutSec: parseSec("timeout"),
    })
  },
})

// ── handoff (GS-2 f9) ─────────────────────────────────────────────────────

const handoff = defineCommand({
  meta: {
    name: "handoff",
    description:
      "GS-2: session-state checkpoint capture — scans .sgc/ state across 6 namespaces, derives Iron Law #2 verify command, writes tasks/<slug>-paused.md.",
  },
  args: {
    auto: {
      type: "boolean",
      required: false,
      description:
        "Auto-detect slug + state from mtime-newest .sgc/decisions/<id>/intent.md and scan all 6 namespaces.",
    },
    print: {
      type: "string",
      required: false,
      description: "Print existing tasks/<slug>-paused.md to stdout (exit 1 if missing).",
    },
  },
  async run({ args }) {
    const { runHandoff } = await import("./commands/handoff")
    const result = await runHandoff({
      auto: args.auto as boolean | undefined,
      print: args.print as string | undefined,
      sgcVersion: packageJson.version,
    })
    process.exit(result.exitCode)
  },
})

// ── land (GS-7 f10) ───────────────────────────────────────────────────────

const land = defineCommand({
  meta: {
    name: "land",
    description:
      "Post-publish ship chain: watch-ci-failure + canary, fail-fast on either.",
  },
  args: {
    package: {
      type: "string",
      description: "Package name (default: package.json#name).",
    },
    version: {
      type: "string",
      description: "Expected version (default: package.json#version).",
    },
  },
  async run({ args }) {
    const { runLandCli } = await import("./commands/land")
    const result = await runLandCli({
      package: args.package,
      version: args.version,
    })
    process.exit(result.exitCode)
  },
})

// ── loop (CE-5 f6) ────────────────────────────────────────────────────────

const loop = defineCommand({
  meta: {
    name: "loop",
    description:
      "CE-5: end-to-end orchestrator chaining plan → [pause work] → review → [pause qa] → [pause ship] → compound. Resume with --resume <run-id>.",
  },
  args: {
    task: {
      type: "positional",
      required: false,
      description:
        "Task description (one sentence) — required unless --resume, --runs, or --status is set",
    },
    resume: {
      type: "string",
      required: false,
      description: "Resume a paused/failed loop run by id",
    },
    runs: {
      type: "boolean",
      required: false,
      description: "List loop runs (running, paused, failed, complete). No TASK arg needed.",
    },
    status: {
      type: "string",
      required: false,
      description: "Show one loop run by id (frontmatter + per-step status). No TASK arg needed.",
    },
    motivation: {
      type: "string",
      required: false,
      description: "Pass-through to plan: long-form rationale (≥20 words)",
    },
    level: {
      type: "string",
      required: false,
      description: "Pass-through to plan: override classifier level (upgrade only)",
    },
    "signed-by": {
      type: "string",
      required: false,
      description: "Pass-through to plan: human signer_id required for L3 intents (Invariant §4)",
    },
  },
  async run({ args }) {
    const { runLoopCommand } = await import("./commands/loop")
    await runLoopCommand({
      task: args.task as string | undefined,
      resume: args.resume as string | undefined,
      runs: args.runs as boolean | undefined,
      status: args.status as string | undefined,
      motivation: args.motivation as string | undefined,
      forceLevel: args.level as "L0" | "L1" | "L2" | "L3" | undefined,
      signedBy: args["signed-by"] as string | undefined,
    })
  },
})

// ── cso (GS-5) ──────────────────────────────────────────────────────────────

const cso = defineCommand({
  meta: {
    name: "cso",
    description:
      "GS-5: pre-ship security review — secret scan + dep audit + events.ndjson anomaly detection. Writes append-only report under .sgc/cso/. Exit 1 on fail, 0 on pass/warn.",
  },
  async run() {
    const { runCso } = await import("./commands/cso")
    const { report } = await runCso()
    if (report.verdict === "fail") process.exit(1)
  },
})

// ── main ────────────────────────────────────────────────────────────────────

const main = defineCommand({
  meta: {
    name: "sgc",
    version: packageJson.version,
    description:
      "SGC — self-contained engineering super-plugin: plan, execute, review, QA, security, ship, and compound knowledge (L0–L3, standalone, no other plugins required)",
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
    loop: () => loop,
    "watch-ci-failure": () => watchCiFailure,
    canary: () => canary,
    cso: () => cso,
    debug: () => debugCommand,
    land: () => land,
    handoff: () => handoff,
    status: () => status,
    "agent-loop": () => agentLoop,
    tail: () => tail,
    metrics: () => metrics,
    doctor: () => doctor,
  },
})

// ── entrypoint ────────────────────────────────────────────────────────────────
//
// citty's runMain renders every thrown Error through consola as a full stack
// trace (printed twice — once via `consola.error(error)`, once via
// `consola.error(error.message)`). For sgc that means an *expected*,
// user-actionable failure ("active task in handoff — pass --force-new-task", an
// LLM provider 403, the verification close-gate) reads like an internal crash.
// Route --help/--version through citty unchanged (it handles those cleanly and
// exits 0), but run commands ourselves so a thrown error surfaces as a single
// clean `error: <message>` line on stderr. Set SGC_DEBUG=1 to restore the full
// stack for diagnosis.
const rawArgs = process.argv.slice(2)
const wantsHelp = rawArgs.includes("--help") || rawArgs.includes("-h")
const wantsVersion = rawArgs.length === 1 && rawArgs[0] === "--version"

if (wantsHelp || wantsVersion) {
  runMain(main)
} else {
  runCommand(main, { rawArgs }).catch(async (error: unknown) => {
    const err = error as { name?: string; message?: string; stack?: string }
    const message = err?.message ?? String(error)
    // Unknown/missing (sub)command or arg → orient the user with usage, as citty does.
    if (err?.name === "CLIError") await showUsage(main)
    process.stderr.write(`\nerror: ${message}\n`)
    if (process.env["SGC_DEBUG"] && err?.stack) {
      process.stderr.write(`\n${err.stack}\n`)
    }
    process.exit(1)
  })
}
