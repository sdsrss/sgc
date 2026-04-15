// Shared helpers for the file-based agent spawn protocol.
// Used by both spawn.ts (writer) and commands/agent-loop.ts (reader/submitter).

import { existsSync, readdirSync } from "node:fs"
import { resolve } from "node:path"

export interface ParsedSpawnId {
  ulid: string
  agentName: string
}

/**
 * spawn_id format: "<ulid>-<agent_name>" where agent_name may contain dots
 * (e.g. "01HXXX…-reviewer.correctness"). The ULID is 26 chars and has no
 * dashes after our normalization, so the first `-` is the delimiter.
 */
export function parseSpawnId(spawnId: string): ParsedSpawnId {
  const dashIdx = spawnId.indexOf("-")
  if (dashIdx === -1) {
    throw new Error(`invalid spawn_id: no dash in ${spawnId}`)
  }
  return {
    ulid: spawnId.slice(0, dashIdx),
    agentName: spawnId.slice(dashIdx + 1),
  }
}

export function promptPath(spawnId: string, stateRoot: string): string {
  return resolve(stateRoot, "progress/agent-prompts", `${spawnId}.md`)
}

export function resultPath(spawnId: string, stateRoot: string): string {
  return resolve(stateRoot, "progress/agent-results", `${spawnId}.md`)
}

export interface SpawnInfo {
  spawnId: string
  agentName: string
  promptPath: string
  resultPath: string
  hasResult: boolean
}

/** Enumerate every spawn under `.sgc/progress/agent-prompts/`. */
export function listAllSpawns(stateRoot: string): SpawnInfo[] {
  const promptsDir = resolve(stateRoot, "progress/agent-prompts")
  if (!existsSync(promptsDir)) return []
  return readdirSync(promptsDir)
    .filter((f) => f.endsWith(".md"))
    .sort()  // deterministic order by ULID = creation time
    .map((f) => {
      const spawnId = f.slice(0, -3)
      const { agentName } = parseSpawnId(spawnId)
      const pp = promptPath(spawnId, stateRoot)
      const rp = resultPath(spawnId, stateRoot)
      return {
        spawnId,
        agentName,
        promptPath: pp,
        resultPath: rp,
        hasResult: existsSync(rp),
      }
    })
}

/** Spawns with no result written yet. */
export function listPendingSpawns(stateRoot: string): SpawnInfo[] {
  return listAllSpawns(stateRoot).filter((s) => !s.hasResult)
}
