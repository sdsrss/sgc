// `sgc agent-loop` — helper for external actors (Claude main session, user)
// to fulfill pending agent spawns.
//
// Four modes:
//
//   sgc agent-loop --list                       list every spawn with status
//   sgc agent-loop --show <spawn_id>            print the prompt file body
//   sgc agent-loop --submit <spawn_id>          read YAML from stdin + write result
//   sgc agent-loop --submit <id> --from <file>  read YAML from file
//   sgc agent-loop                              interactive: show next pending spawn
//
// The dispatcher's spawn() polls for the result file; submit writes that file
// atomically after validating against the manifest's outputs schema
// (Invariant §9).

import { existsSync, readFileSync } from "node:fs"
import { load as yamlLoad } from "js-yaml"
import { getSubagentManifest } from "../dispatcher/schema"
import { getFingerprintsCached, scanOutputForLeak } from "../dispatcher/fingerprint"
import {
  listAllSpawns,
  listPendingSpawns,
  parseSpawnId,
  promptPath as promptPathOf,
  resultPath as resultPathOf,
} from "../dispatcher/spawn-protocol"
import { serializeFrontmatter, writeAtomic } from "../dispatcher/state"
import { validateOutputShape } from "../dispatcher/validation"
import { createLogger, type Logger } from "../dispatcher/logger"

export interface AgentLoopOptions {
  stateRoot?: string
  list?: boolean
  show?: string
  submit?: string
  fromFile?: string
  // stdin provider for tests; defaults to process.stdin
  readStdin?: () => Promise<string>
  log?: (msg: string) => void
  logger?: Logger
}

function stateRoot(custom?: string): string {
  return custom ?? process.env["SGC_STATE_ROOT"] ?? ".sgc"
}


async function readAllStdin(): Promise<string> {
  const chunks: string[] = []
  process.stdin.setEncoding("utf8")
  for await (const chunk of process.stdin) chunks.push(chunk as string)
  return chunks.join("")
}

export async function runAgentLoop(opts: AgentLoopOptions = {}): Promise<{
  action: "list" | "show" | "submit" | "interactive"
  submittedTo?: string
}> {
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot, say: opts.log })
  const log = (m: string) => logger.say(m)
  const root = stateRoot(opts.stateRoot)

  if (opts.list) {
    const all = listAllSpawns(root)
    if (all.length === 0) {
      log(`no spawns under ${root}/progress/agent-prompts/`)
      return { action: "list" }
    }
    const pending = all.filter((s) => !s.hasResult).length
    log(`${all.length} spawn(s) (${pending} pending):`)
    for (const s of all) {
      const marker = s.hasResult ? "[x]" : "[ ]"
      log(`  ${marker} ${s.spawnId}`)
    }
    return { action: "list" }
  }

  if (opts.show) {
    const pp = promptPathOf(opts.show, root)
    if (!existsSync(pp)) {
      throw new Error(`prompt file not found: ${pp}`)
    }
    log(readFileSync(pp, "utf8"))
    return { action: "show" }
  }

  if (opts.submit) {
    const { agentName } = parseSpawnId(opts.submit)
    const manifest = getSubagentManifest(agentName)
    if (!manifest) {
      throw new Error(`unknown agent '${agentName}' (from spawn_id ${opts.submit})`)
    }
    const pp = promptPathOf(opts.submit, root)
    const rp = resultPathOf(opts.submit, root)
    if (!existsSync(pp)) {
      throw new Error(
        `no prompt file for ${opts.submit}; maybe typo, or the spawn was never requested`,
      )
    }
    if (existsSync(rp)) {
      throw new Error(`result already written for ${opts.submit}; submissions are one-shot`)
    }

    const text = opts.fromFile
      ? readFileSync(opts.fromFile, "utf8")
      : await (opts.readStdin ?? readAllStdin)()
    // Accept either bare YAML or frontmatter-wrapped YAML (strip fences).
    const stripped = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)?.[1] ?? text
    const parsed = yamlLoad(stripped)
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("submitted YAML must parse to an object")
    }

    // Invariant §9: reject undeclared / wrong-type fields BEFORE writing.
    validateOutputShape(manifest, parsed)

    // P3-5: Invariant §1 output-side leak scan, same gate spawn() applies to
    // every subagent result. This path skipped it: §9 rejects undeclared FIELDS
    // but cannot inspect VALUE content, so a reviewer result quoting solutions/
    // walked straight onto disk. The file-poll flow masked it (the polling
    // spawn() re-validates after pollForResult), but --submit exists precisely
    // for the case with no live poller — an external actor fulfilling a spawn by
    // hand — and there the scan never ran at all.
    //
    // Fails closed: the throw happens BEFORE writeAtomic, so a rejected result
    // is never readable by a later poll.
    const leak = scanOutputForLeak(agentName, parsed, getFingerprintsCached(root))
    if (leak.hit) {
      // M4: record the trip. spawn()'s equivalent rejection is visible to
      // `sgc tail` as spawn.end{outcome:"error"}; this path threw silently —
      // so a §1 violation arriving through the one path with no live poller
      // (the whole reason --submit exists) left no audit trace at all. A gate
      // whose trips are not recorded cannot be shown to have ever worked.
      //
      // Count, not content: `leak.samples` IS the solution text the agent was
      // not allowed to see. Copying it into events.ndjson would leak it a
      // second time, into a file tail prints and cso reads. The operator has
      // the sample in the thrown message already.
      logger.event({
        task_id: null,
        spawn_id: opts.submit,
        agent: agentName,
        event_type: "submit.rejected",
        level: "error",
        payload: { reason: "invariant_1_output_leak", match_count: leak.count },
      })
      throw new Error(
        `Invariant §1 violation (output leak): submitted result for ${agentName} contains ${leak.count} line(s) matching solutions/ content. ` +
          `Sample(s): ${leak.samples.map((s) => `"${s}"`).join(", ")}. ` +
          `Reviewers and qa agents must stay amnesiac to past solutions — see sgc-invariants.md §1.`,
      )
    }

    writeAtomic(rp, serializeFrontmatter(parsed as Record<string, unknown>, ""))
    log(`wrote ${rp}`)
    return { action: "submit", submittedTo: rp }
  }

  // Interactive: show next pending + instructions
  const pending = listPendingSpawns(root)
  if (pending.length === 0) {
    log(`no pending spawns; dispatcher has nothing to process`)
    return { action: "interactive" }
  }
  const next = pending[0]!
  const { agentName: nextAgent } = parseSpawnId(next.spawnId)
  log(`Next pending: ${next.spawnId}`)
  log(``)
  log(`Prompt:  ${next.promptPath}`)
  log(`Reply:   ${next.resultPath}`)
  log(``)
  // P3#10: when inside a Claude Code session, prefer Task() invocation —
  // the file-poll handshake is for headless / parent-Claude orchestration.
  if (process.env["CLAUDE_PLUGIN_ROOT"]) {
    log(`Inside Claude Code session — invoke via Task() directly:`)
    log(`  Task({ subagent_type: "${nextAgent}", prompt: <prompt body>, ... })`)
    log(`Then submit the YAML output:`)
    log(`  sgc agent-loop --submit ${next.spawnId} --from <yaml-file>`)
    log(``)
    log(`(file-poll dispatch is disabled inside Claude Code per P3#10; ` +
        `set SGC_USE_FILE_AGENTS=0 or use anthropic-sdk/openrouter for direct LLM dispatch)`)
  } else {
    log(`Read the prompt, then submit via:`)
    log(`  sgc agent-loop --submit ${next.spawnId} --from <yaml-file>`)
    log(`  cat <yaml-file> | sgc agent-loop --submit ${next.spawnId}`)
  }
  log(``)
  log(`(${pending.length - 1} more pending after this)`)
  return { action: "interactive" }
}
