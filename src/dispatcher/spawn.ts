// Subagent spawn protocol.
//
// Two modes:
//   1. inline-stub (default for MVP) — execute a hardcoded function.
//      Still writes prompt + result files to .sgc/progress/agent-prompts/
//      and agent-results/ for audit trail. This is what `sgc plan/review/...`
//      use today.
//   2. file-poll (set SGC_USE_FILE_AGENTS=1) — write prompt, then poll for
//      a result file written by an external actor (Claude main session,
//      another agent, etc.). Times out per manifest.timeout_s.
//
// In both modes:
//   - scope tokens are computed at spawn time and pinned (Invariant §8)
//   - manifest's forbidden_for is enforced (Invariant §1)
//   - result is shape-checked against manifest's `outputs` declaration
//     (field-presence only for MVP)
//   - prompt + result are persisted for audit
//
// Future D-phase: swap pollForResult for an actual Task() invocation; the
// inline stubs become real LLM-backed agents. Caller code (e.g. sgc plan)
// stays unchanged.

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { dump as yamlDump } from "js-yaml"
import { computeSubagentTokens } from "./capabilities"
import { getSubagentManifest } from "./schema"
import {
  StateError,
  ensureSgcStructure,
  parseFrontmatter,
  serializeFrontmatter,
} from "./state"
import type { ScopeToken, SubagentManifest } from "./types"

// node:fs writeFileSync via state.ts internal helper would be cleaner;
// for now duplicate atomic write for spawn-specific paths.
import { mkdirSync, renameSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

function writeAtomic(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`
  writeFileSync(tmp, content, "utf8")
  renameSync(tmp, path)
}

export class SpawnTimeout extends Error {
  constructor(spawnId: string, timeoutMs: number) {
    super(`spawn ${spawnId} timed out waiting for result after ${timeoutMs}ms`)
    this.name = "SpawnTimeout"
  }
}

export class OutputShapeMismatch extends Error {
  constructor(agent: string, missing: string[]) {
    super(`agent ${agent} output missing required fields: ${missing.join(", ")}`)
    this.name = "OutputShapeMismatch"
  }
}

export type InlineStub<I = unknown, O = unknown> = (input: I) => O | Promise<O>

export interface SpawnOptions {
  stateRoot?: string
  inlineStub?: InlineStub
  timeoutMs?: number  // overrides manifest.timeout_s
  pollIntervalMs?: number
  ulid?: string  // override for tests
}

const root = (custom?: string): string =>
  resolve(custom ?? process.env["SGC_STATE_ROOT"] ?? ".sgc")

function generateUlid(): string {
  // Lookalike — not Crockford base32 but 26-char hex-ish for MVP.
  // Schema validation does not enforce strict ULID grammar.
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase()
}

function shouldUseFilePoll(): boolean {
  return process.env["SGC_USE_FILE_AGENTS"] === "1"
}

function expectedOutputFields(manifest: SubagentManifest): string[] {
  const out = manifest.outputs
  if (!out || typeof out !== "object") return []
  return Object.keys(out)
}

function validateOutputShape(manifest: SubagentManifest, result: unknown): void {
  if (typeof result !== "object" || result === null) {
    throw new OutputShapeMismatch(manifest.name, expectedOutputFields(manifest))
  }
  const required = expectedOutputFields(manifest)
  const present = new Set(Object.keys(result as Record<string, unknown>))
  const missing = required.filter((k) => !present.has(k))
  if (missing.length > 0) {
    throw new OutputShapeMismatch(manifest.name, missing)
  }
}

function formatPrompt(
  spawnId: string,
  manifest: SubagentManifest,
  input: unknown,
  tokens: ScopeToken[],
  resultPath: string,
): string {
  const fm = {
    spawn_id: spawnId,
    agent: manifest.name,
    version: manifest.version,
    scope_tokens: tokens,
    timeout_s: manifest.timeout_s ?? 60,
    expected_outputs: manifest.outputs ?? {},
  }
  const body =
    `## Purpose\n\n${manifest.purpose ?? "(no purpose declared)"}\n\n` +
    `## Input\n\n\`\`\`yaml\n${yamlDump(input).trimEnd()}\n\`\`\`\n\n` +
    `## Instructions\n\n` +
    `Write your response to: \`${resultPath}\`\n\n` +
    `Format: YAML frontmatter matching expected_outputs above, plus optional markdown body.\n`
  return serializeFrontmatter(fm as Record<string, unknown>, body)
}

async function pollForResult(
  resultPath: string,
  timeoutMs: number,
  intervalMs: number,
): Promise<unknown> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (existsSync(resultPath)) {
      const text = readFileSync(resultPath, "utf8")
      const { data } = parseFrontmatter(text)
      return data
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new SpawnTimeout(resultPath, timeoutMs)
}

export interface SpawnResult<O> {
  spawnId: string
  output: O
  promptPath: string
  resultPath: string
}

export async function spawn<I = unknown, O = unknown>(
  agentName: string,
  input: I,
  opts: SpawnOptions = {},
): Promise<SpawnResult<O>> {
  const manifest = getSubagentManifest(agentName)
  if (!manifest) {
    throw new StateError("NotFound", `subagent manifest not found: ${agentName}`)
  }
  // Compute + pin scope tokens (Invariant §8). Throws ScopeViolation if
  // manifest declares a forbidden token (e.g. reviewer.* with read:solutions).
  const tokens = computeSubagentTokens(agentName)

  ensureSgcStructure(opts.stateRoot)
  const stateRoot = root(opts.stateRoot)
  const ulid = opts.ulid ?? generateUlid()
  const spawnId = `${ulid}-${agentName}`
  const promptPath = resolve(stateRoot, "progress/agent-prompts", `${spawnId}.md`)
  const resultPath = resolve(stateRoot, "progress/agent-results", `${spawnId}.md`)

  writeAtomic(promptPath, formatPrompt(spawnId, manifest, input, tokens, resultPath))

  let output: unknown
  if (opts.inlineStub && !shouldUseFilePoll()) {
    output = await opts.inlineStub(input)
    // Persist result for audit trail
    writeAtomic(
      resultPath,
      serializeFrontmatter(output as Record<string, unknown>, ""),
    )
  } else {
    const timeoutMs = opts.timeoutMs ?? (manifest.timeout_s ?? 60) * 1000
    output = await pollForResult(resultPath, timeoutMs, opts.pollIntervalMs ?? 1000)
  }

  validateOutputShape(manifest, output)

  return { spawnId, output: output as O, promptPath, resultPath }
}
