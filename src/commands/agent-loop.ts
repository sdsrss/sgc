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

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { load as yamlLoad } from "js-yaml"
import { getSubagentManifest } from "../dispatcher/schema"
import {
  listAllSpawns,
  listPendingSpawns,
  parseSpawnId,
  promptPath as promptPathOf,
  resultPath as resultPathOf,
} from "../dispatcher/spawn-protocol"
import { serializeFrontmatter } from "../dispatcher/state"
import { validateOutputShape } from "../dispatcher/validation"

export interface AgentLoopOptions {
  stateRoot?: string
  list?: boolean
  show?: string
  submit?: string
  fromFile?: string
  // stdin provider for tests; defaults to process.stdin
  readStdin?: () => Promise<string>
  log?: (msg: string) => void
}

function stateRoot(custom?: string): string {
  return custom ?? process.env["SGC_STATE_ROOT"] ?? ".sgc"
}

function writeAtomic(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`
  writeFileSync(tmp, content, "utf8")
  renameSync(tmp, path)
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
  const log = opts.log ?? ((m) => console.log(m))
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
  log(`Next pending: ${next.spawnId}`)
  log(``)
  log(`Prompt:  ${next.promptPath}`)
  log(`Reply:   ${next.resultPath}`)
  log(``)
  log(`Read the prompt, then submit via:`)
  log(`  sgc agent-loop --submit ${next.spawnId} --from <yaml-file>`)
  log(`  cat <yaml-file> | sgc agent-loop --submit ${next.spawnId}`)
  log(``)
  log(`(${pending.length - 1} more pending after this)`)
  return { action: "interactive" }
}
