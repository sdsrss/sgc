// `sgc debug` — 4-phase systematic-debugging walker.
//
// GS-4 (f11). Thin wrapper around src/dispatcher/debug.ts; routes to
// runDebugStart / runDebugClose / runDebugList / runDebugStatus based on
// positional args and flags. Lazy-imports the dispatcher functions.

import { defineCommand } from "citty"
import type { DebugResult } from "../dispatcher/debug"

export const debugCommand = defineCommand({
  meta: {
    name: "debug",
    description:
      "4-phase systematic-debugging walker (investigate, analyze, hypothesize, implement). Iron Law #3 hard-gate on close.",
  },
  args: {
    subcommand: {
      type: "positional",
      required: false,
      description: "subcommand: start | close (omit to use --runs/--status flag mode)",
    },
    symptom: {
      type: "positional",
      required: false,
      description: "(start) one-liner symptom description",
    },
    id: {
      type: "string",
      description: "(close | --status) investigation id",
    },
    "root-cause": {
      type: "string",
      description: "(close) Iron Law #3 root cause explanation",
    },
    "fix-commit": {
      type: "string",
      description: "(close) Iron Law #3 fix commit SHA (7-40 hex chars)",
    },
    "verify-command": {
      type: "string",
      description: "(close) Iron Law #3 verify command (arbitrary string; operator responsibility)",
    },
    runs: {
      type: "boolean",
      default: false,
      description: "list all investigations",
    },
    status: {
      type: "string",
      description: "show single investigation by id",
    },
    "state-root": {
      type: "string",
      description: "(hidden test seam) override .sgc/ location",
    },
    "repo-root": {
      type: "string",
      description: "(hidden test seam) override cwd",
    },
  },
  async run({ args }) {
    const stateRoot = (args as Record<string, unknown>)["state-root"] as string | undefined
    const repoRoot = (args as Record<string, unknown>)["repo-root"] as string | undefined
    const subcommand = args.subcommand as string | undefined

    let result: DebugResult

    if (args.runs === true) {
      const { runDebugList } = await import("../dispatcher/debug")
      result = await runDebugList({ stateRoot })
    } else if (typeof args.status === "string" && args.status.length > 0) {
      const { runDebugStatus } = await import("../dispatcher/debug")
      result = await runDebugStatus({ id: args.status, stateRoot })
    } else if (subcommand === "start") {
      const symptom = (args.symptom as string | undefined) ?? ""
      if (symptom.length === 0) {
        process.stderr.write(`usage: sgc debug start "<symptom>"\n`)
        process.exit(1)
      }
      const { runDebugStart } = await import("../dispatcher/debug")
      result = await runDebugStart({ symptom, stateRoot, repoRoot })
    } else if (subcommand === "close") {
      const id = (args.id as string | undefined) ?? ""
      const rootCause = ((args as Record<string, unknown>)["root-cause"] as string | undefined) ?? ""
      const fixCommit = ((args as Record<string, unknown>)["fix-commit"] as string | undefined) ?? ""
      const verifyCommand =
        ((args as Record<string, unknown>)["verify-command"] as string | undefined) ?? ""
      if (id.length === 0 || rootCause.length === 0 || fixCommit.length === 0 || verifyCommand.length === 0) {
        process.stderr.write(
          `usage: sgc debug close --id <id> --root-cause "<text>" --fix-commit <sha> --verify-command "<cmd>"\n`,
        )
        process.exit(1)
      }
      const { runDebugClose } = await import("../dispatcher/debug")
      result = await runDebugClose({ id, rootCause, fixCommit, verifyCommand, stateRoot })
    } else {
      process.stderr.write(
        `usage: sgc debug start "<symptom>" | close --id <id> --root-cause "<text>" --fix-commit <sha> --verify-command "<cmd>" | --runs | --status <id>\n`,
      )
      process.exit(1)
    }

    process.exit(result.exitCode)
  },
})
