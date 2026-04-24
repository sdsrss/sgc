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
import { dump as yamlDump } from "js-yaml"
import { computeSubagentTokens } from "./capabilities"
import { getCapabilities, getSubagentManifest } from "./schema"
import {
  StateError,
  ensureSgcStructure,
  parseFrontmatter,
  serializeFrontmatter,
} from "./state"
import { promptPath as getPromptPath, resultPath as getResultPath } from "./spawn-protocol"
import { validateOutputShape } from "./validation"
import { runClaudeCliAgent, type SubprocessRunner } from "./claude-cli-agent"
import {
  runAnthropicSdkAgent,
  type AnthropicClientFactory,
} from "./anthropic-sdk-agent"
import {
  runOpenRouterAgent,
  type OpenRouterFetch,
} from "./openrouter-agent"
import type { ScopeToken, SubagentManifest } from "./types"
import type { Logger } from "./logger"
import { createLogger } from "./logger"

// Re-export for callers that referenced OutputShapeMismatch from spawn.ts
export { OutputShapeMismatch } from "./validation"

// node:fs writeFileSync via state.ts internal helper would be cleaner;
// for now duplicate atomic write for spawn-specific paths.
import { mkdirSync, renameSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

function writeAtomic(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`
  writeFileSync(tmp, content, "utf8")
  renameSync(tmp, path)
}

/** Minimum timeout for any spawn (prevents instant-timeout from misconfigured manifests). */
export const MIN_TIMEOUT_MS = 30_000 // 30 seconds

/** Maximum timeout for any spawn (prevents indefinite hangs). */
export const MAX_TIMEOUT_MS = 300_000 // 5 minutes

/** Clamp raw timeout to [MIN_TIMEOUT_MS, MAX_TIMEOUT_MS]. Exported for unit testing. */
export function clampTimeout(rawMs: number): number {
  return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, rawMs))
}

export class SpawnTimeout extends Error {
  constructor(spawnId: string, timeoutMs: number) {
    super(`spawn ${spawnId} timed out waiting for result after ${timeoutMs}ms`)
    this.name = "SpawnTimeout"
  }
}

/**
 * Misconfiguration of a subagent manifest — e.g. declared `prompt_path`
 * points to a missing file, or the template is missing required markers.
 * These are always programmer/config errors, not runtime LLM errors, so
 * they are fatal and do not retry.
 */
export class SpawnError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SpawnError"
  }
}

export type InlineStub<I = unknown, O = unknown> = (input: I) => O | Promise<O>

export type AgentMode = "inline" | "file-poll" | "claude-cli" | "anthropic-sdk" | "openrouter"

export interface SpawnOptions {
  stateRoot?: string
  inlineStub?: InlineStub
  timeoutMs?: number  // overrides manifest.timeout_s
  pollIntervalMs?: number
  ulid?: string  // override for tests
  mode?: AgentMode  // explicit override; else resolved from env
  claudeCliRunner?: SubprocessRunner  // test hook for claude-cli mode
  anthropicClientFactory?: AnthropicClientFactory  // test hook for anthropic-sdk mode
  openRouterFetch?: OpenRouterFetch  // test hook for openrouter mode
  hasClaudeCli?: () => boolean  // test hook for resolveMode auto-detect
  /** Max retry attempts for file-poll mode on SpawnTimeout. Default 0 (no retry). */
  maxRetries?: number
  /**
   * Test-only fault injection — if set, throw this error after writing
   * the prompt file but before producing the result. Used by Invariant §10
   * (compound transaction atomicity) tests to prove runCompound rolls
   * back cleanly when a mid-cluster spawn fails.
   */
  forceError?: Error
  /** Task ID threaded into events for correlation. null for pre-task spawns. Phase G.1.a (Invariant §13). */
  taskId?: string
  /** Injectable event sink; defaults to createLogger({}). Phase G.1.a (Invariant §13). */
  logger?: Logger
}

const root = (custom?: string): string =>
  resolve(custom ?? process.env["SGC_STATE_ROOT"] ?? ".sgc")

function generateUlid(): string {
  // Lookalike — not Crockford base32 but 26-char hex-ish for MVP.
  // Schema validation does not enforce strict ULID grammar.
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase()
}

/**
 * Resolve which agent dispatch mode to use, in priority:
 *   1. explicit opts.mode
 *   2. SGC_AGENT_MODE env ("inline" | "file-poll" | "claude-cli" | "anthropic-sdk" | "openrouter")
 *   3. SGC_USE_FILE_AGENTS=1 (legacy alias for file-poll)
 *   4. manifest.prompt_path + ANTHROPIC_API_KEY → "anthropic-sdk" (LLM only for agents with templates)
 *   5. manifest.prompt_path + OPENROUTER_API_KEY → "openrouter" (chat/completions via fetch)
 *   6. opts.inlineStub provided → "inline" (fallback: agents without prompt_path always use stubs)
 *   7. ANTHROPIC_API_KEY (no prompt_path) → "anthropic-sdk" (catch-all for templateless agents if no stub)
 *   8. OPENROUTER_API_KEY (no prompt_path) → "openrouter"
 *   9. `claude` CLI in PATH → "claude-cli" (auto-detect for subscription users)
 *   10. default → "file-poll"
 *
 * Exported for direct testing.
 */
export function resolveMode(opts: SpawnOptions = {}, manifest?: SubagentManifest): AgentMode {
  if (opts.mode) return opts.mode
  const envMode = process.env["SGC_AGENT_MODE"]
  if (
    envMode === "inline" ||
    envMode === "file-poll" ||
    envMode === "claude-cli" ||
    envMode === "anthropic-sdk" ||
    envMode === "openrouter"
  ) {
    return envMode
  }
  if (process.env["SGC_USE_FILE_AGENTS"] === "1") return "file-poll"
  // Test escape hatch: SGC_FORCE_INLINE=1 forces inline stubs regardless of API keys.
  // Used by test runner to prevent real API calls during CI/eval.
  if (process.env["SGC_FORCE_INLINE"] === "1" && opts.inlineStub) return "inline"
  // When the agent has a prompt template (prompt_path), prefer LLM over inline stub.
  // Agents WITHOUT prompt_path always fall through to inlineStub — heuristic fallback.
  const hasTemplate = !!manifest?.prompt_path
  if (hasTemplate && process.env["ANTHROPIC_API_KEY"]) return "anthropic-sdk"
  if (hasTemplate && process.env["OPENROUTER_API_KEY"]) return "openrouter"
  if (opts.inlineStub) return "inline"
  // Catch-all for agents without stubs: try LLM keys, then CLI, then poll
  if (process.env["ANTHROPIC_API_KEY"]) return "anthropic-sdk"
  if (process.env["OPENROUTER_API_KEY"]) return "openrouter"
  const hasCli = opts.hasClaudeCli ?? (() => Bun.which("claude") !== null)
  if (hasCli()) return "claude-cli"
  return "file-poll"
}

// validateOutputShape moved to src/dispatcher/validation.ts so agent-loop
// can share it without circular imports. Re-exported at top of this file.

/**
 * Compute the list of tokens explicitly forbidden for this subagent by the
 * capabilities spec (so the prompt can remind the agent — defense in depth).
 */
function forbiddenTokensFor(agentName: string): string[] {
  const spec = getCapabilities()
  const out: string[] = []
  for (const [token, def] of Object.entries(spec.scope_tokens)) {
    if (!def.forbidden_for) continue
    for (const pat of def.forbidden_for) {
      const re = pat.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")
      if (new RegExp(`^${re}$`).test(agentName)) {
        out.push(token)
        break
      }
    }
  }
  return out
}

/**
 * Render the prompt file for a subagent spawn.
 *
 * Layout is split into two sections around the `## Input` heading so the
 * anthropic-sdk agent mode can cache the stable prefix (Anthropic
 * cache_control: ephemeral):
 *
 *   Pre-`## Input` (stable per agent — system block, cached):
 *     Derived ONLY from the manifest — purpose + expected-output schema +
 *     reply-format guidance. Byte-identical across calls for the same agent,
 *     so the cache key is stable and hits.
 *
 *   `## Input` onward (varies per call — user block, not cached):
 *     Frontmatter with spawn_id + computed scope_tokens, the task input YAML,
 *     the per-spawn scope reminder, and the resultPath (which embeds
 *     spawn_id). Cannot be cached because every field here is per-call.
 *
 * Exported for tests that need to verify caching invariants without writing
 * prompt files to disk.
 */
export function formatPrompt(
  spawnId: string,
  manifest: SubagentManifest,
  input: unknown,
  tokens: ScopeToken[],
  resultPath: string,
): string {
  // Template-based path: when manifest.prompt_path is declared, load the
  // external template and substitute <input_yaml/> with the per-call input
  // YAML. The template itself owns the stable prefix (everything above
  // `## Input`) — spawnId, tokens, resultPath are NOT injected; for audit
  // they live in the prompt filename / scope-token computation instead.
  // This keeps the system block byte-stable across calls so cache_control
  // hits (anthropic-sdk mode). Template is authored to contain the
  // `## Input` marker and `<input_yaml/>` placeholder.
  if (manifest.prompt_path) {
    const templatePath = resolve(process.cwd(), manifest.prompt_path)
    if (!existsSync(templatePath)) {
      throw new SpawnError(
        `prompt_path declared (${manifest.prompt_path}) but file does not exist for agent ${manifest.name}`,
      )
    }
    const template = readFileSync(templatePath, "utf8")
    if (!template.includes("<input_yaml/>")) {
      throw new SpawnError(
        `prompt_path ${manifest.prompt_path} missing <input_yaml/> placeholder for agent ${manifest.name}`,
      )
    }
    // Must contain a `## Input` heading at start of a line so splitPrompt
    // can isolate the stable system prefix for cache_control.
    if (!/(^|\r?\n)##[ \t]+Input[ \t]*\r?\n/.test(template)) {
      throw new SpawnError(
        `prompt_path ${manifest.prompt_path} missing '## Input' heading for agent ${manifest.name}`,
      )
    }
    const inputYaml = yamlDump(input).trimEnd()
    return template.replace("<input_yaml/>", inputYaml)
  }

  const forbidden = forbiddenTokensFor(manifest.name)
  // Stable per-agent prefix — MUST NOT reference spawnId, tokens (computed
  // per call), resultPath, or the input payload. Anything added here breaks
  // cache-key stability.
  const systemPrefix =
    `# Purpose\n\n${manifest.purpose ?? "(no purpose declared)"}\n\n` +
    `## Expected output\n\n` +
    `\`\`\`yaml\n${yamlDump(manifest.outputs ?? {}).trimEnd()}\n\`\`\`\n\n` +
    `## Reply format\n\n` +
    `Your response must be a YAML document whose frontmatter matches the \`Expected output\` schema above — exact keys, matching types (enum members, array shapes, string/number primitives). Extra fields are rejected by the dispatcher (Invariant §9).\n`

  // Per-call frontmatter. Lives inside the user block (below `## Input`)
  // because every field here changes per spawn.
  const fm = {
    spawn_id: spawnId,
    agent: manifest.name,
    version: manifest.version,
    scope_tokens: tokens,
    forbidden_tokens: forbidden,
    timeout_s: manifest.timeout_s ?? 60,
  }
  const inputBlock =
    `## Input\n\n` +
    `${serializeFrontmatter(fm as Record<string, unknown>, "").trimEnd()}\n\n` +
    `### Your scope (this call)\n\n` +
    `You hold these pinned tokens: ${tokens.map((t) => `\`${t}\``).join(", ") || "(none)"}.\n` +
    (forbidden.length > 0
      ? `You are FORBIDDEN from: ${forbidden.map((t) => `\`${t}\``).join(", ")} (Invariant §1).\n`
      : "") +
    `\n### Task input\n\n\`\`\`yaml\n${yamlDump(input).trimEnd()}\n\`\`\`\n\n` +
    `## Submit\n\n` +
    `Write your YAML to: \`${resultPath}\`\n\n` +
    `Or use the helper:\n\n` +
    `\`\`\`bash\n` +
    `echo 'your YAML here' | bun src/sgc.ts agent-loop --submit ${spawnId}\n` +
    `# or:\n` +
    `bun src/sgc.ts agent-loop --submit ${spawnId} --from /path/to/result.yaml\n` +
    `\`\`\`\n`

  return `${systemPrefix}\n${inputBlock}`
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
  const promptPath = getPromptPath(spawnId, stateRoot)
  const resultPath = getResultPath(spawnId, stateRoot)

  writeAtomic(promptPath, formatPrompt(spawnId, manifest, input, tokens, resultPath))

  // Hoist mode resolution so spawn.start payload can include it.
  // INVARIANT: resolveMode must remain non-throwing. §13 Tier 1 guarantees
  // spawn.start fires once we pass the manifest check; a throw here would
  // silently skip the start event and break the paired-event contract.
  const mode = resolveMode(opts, manifest)

  // Invariant §13 Tier 1: emit spawn.start before any dispatch work begins.
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot })
  const startTs = Date.now()
  logger.event({
    task_id: opts.taskId ?? null,
    spawn_id: spawnId,
    agent: agentName,
    event_type: "spawn.start",
    level: "info",
    payload: { mode, manifest_version: manifest.version ?? "unknown" },
  })

  let outcome: "success" | "timeout" | "error" = "error"
  try {
    // Test-only fault injection — after prompt write + spawn.start, before result.
    // Mirrors a mid-spawn failure (e.g. LLM timeout). The prompt audit trail
    // remains on disk; the result file is not written. spawn.start already
    // fired so the paired spawn.end(error) will be emitted via finally.
    if (opts.forceError) {
      throw opts.forceError
    }

    let output: unknown
    if (mode === "inline" && opts.inlineStub) {
      output = await opts.inlineStub(input)
      writeAtomic(
        resultPath,
        serializeFrontmatter(output as Record<string, unknown>, ""),
      )
    } else if (mode === "claude-cli") {
      output = await runClaudeCliAgent(
        promptPath,
        manifest,
        opts.claudeCliRunner,
        { spawnId, taskId: opts.taskId ?? null, agentName, logger },
      )
      writeAtomic(
        resultPath,
        serializeFrontmatter(output as Record<string, unknown>, ""),
      )
    } else if (mode === "anthropic-sdk") {
      output = await runAnthropicSdkAgent(
        promptPath,
        manifest,
        opts.anthropicClientFactory,
        { spawnId, taskId: opts.taskId ?? null, agentName, logger },
      )
      writeAtomic(
        resultPath,
        serializeFrontmatter(output as Record<string, unknown>, ""),
      )
    } else if (mode === "openrouter") {
      output = await runOpenRouterAgent(
        promptPath,
        manifest,
        opts.openRouterFetch,
        { spawnId, taskId: opts.taskId ?? null, agentName, logger },
      )
      writeAtomic(
        resultPath,
        serializeFrontmatter(output as Record<string, unknown>, ""),
      )
    } else {
      // file-poll with timeout clamp + optional retry
      const rawTimeoutMs = opts.timeoutMs ?? (manifest.timeout_s ?? 60) * 1000
      const timeoutMs = clampTimeout(rawTimeoutMs)
      const maxRetries = opts.maxRetries ?? 0

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          output = await pollForResult(resultPath, timeoutMs, opts.pollIntervalMs ?? 1000)
          break
        } catch (e) {
          if (e instanceof SpawnTimeout && attempt < maxRetries) {
            // Exponential backoff: 2^attempt seconds with ±20% jitter
            const baseMs = Math.pow(2, attempt) * 1000
            const jitter = baseMs * 0.2 * (2 * Math.random() - 1)
            await new Promise((r) => setTimeout(r, Math.max(100, baseMs + jitter)))
            continue
          }
          throw e
        }
      }
    }

    validateOutputShape(manifest, output)

    outcome = "success"
    return { spawnId, output: output as O, promptPath, resultPath }
  } catch (e) {
    outcome = e instanceof SpawnTimeout ? "timeout" : "error"
    throw e
  } finally {
    logger.event({
      task_id: opts.taskId ?? null,
      spawn_id: spawnId,
      agent: agentName,
      event_type: "spawn.end",
      level: outcome === "success" ? "info" : "warn",
      payload: { outcome, elapsed_ms: Date.now() - startTs },
    })
  }
}
