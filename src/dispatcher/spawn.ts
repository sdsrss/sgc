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
  writeAtomic,
} from "./state"
import { promptPath as getPromptPath, resultPath as getResultPath } from "./spawn-protocol"
import { validateOutputShape, detectBannedVocab } from "./validation"
import { getFingerprintsCached, scanOutputForLeak } from "./fingerprint"
import { runClaudeCliAgent, type SubprocessRunner } from "./claude-cli-agent"
import { whichSync } from "./subprocess"
import {
  runAnthropicSdkAgent,
  type AnthropicClientFactory,
} from "./anthropic-sdk-agent"
import {
  runOpenRouterAgent,
  type OpenRouterFetch,
} from "./openrouter-agent"
import type { ScopeToken, SubagentManifest } from "./types"
import type { Logger, LlmAgentContext } from "./logger"
import { createLogger } from "./logger"
import { readPrompt } from "./embedded-data"

// Re-export for callers that referenced OutputShapeMismatch from spawn.ts
export { OutputShapeMismatch } from "./validation"

import { resolve } from "node:path"

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

// ── STAB-6: bounded exponential-backoff retry for transient failures ─────────
//
// Both file-poll (SpawnTimeout) and the three LLM modes (claude-cli /
// anthropic-sdk / openrouter) can hit transient failures — a poll that times
// out under load, a 429 rate-limit, a 503/529 overload, an aborted long fetch.
// Previously only file-poll retried (inline loop); the LLM branches threw on
// the first transient error. This shared helper unifies the backoff so a
// transient LLM error is retried with the same 2^attempt-seconds ±20%-jitter
// schedule the file-poll path already used.

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms))

export interface RetryOptions {
  /** Number of retries AFTER the initial attempt (so total tries = maxRetries + 1). */
  maxRetries: number
  /** Predicate: is this error worth retrying? Non-retryable errors rethrow immediately. */
  isRetryable: (e: unknown) => boolean
  sleep?: (ms: number) => Promise<void>
  rng?: () => number
  /** Base backoff in ms (delay for attempt N = 2^N * baseDelayMs ± 20% jitter, floored at 100ms). */
  baseDelayMs?: number
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const sleep = opts.sleep ?? defaultSleep
  const rng = opts.rng ?? Math.random
  const base = opts.baseDelayMs ?? 1000
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (e) {
      if (attempt < opts.maxRetries && opts.isRetryable(e)) {
        const baseMs = Math.pow(2, attempt) * base
        const jitter = baseMs * 0.2 * (2 * rng() - 1)
        await sleep(Math.max(100, baseMs + jitter))
        continue
      }
      throw e
    }
  }
}

/**
 * STAB-6: classify an LLM-mode error as transient (worth retrying) vs fatal.
 * Transient: HTTP 408/409/429/5xx (OpenRouterError / AnthropicSdkError carry
 * `.status`), or an abort/timeout (claude-cli "exceeded Nms", openrouter
 * "timed out", a raw AbortError). Everything else (400/404, parse errors,
 * shape mismatches, auth failures) is fatal — retrying would only waste tokens.
 */
export function isTransientLlmError(e: unknown): boolean {
  const status = (e as { status?: unknown } | null | undefined)?.status
  if (typeof status === "number") {
    if (status === 408 || status === 409 || status === 429 || status >= 500) {
      return true
    }
    return false
  }
  const name = (e as { name?: unknown } | null | undefined)?.name
  if (name === "AbortError") return true
  const msg = e instanceof Error ? e.message : ""
  // Transient signals that arrive as a MESSAGE, not a numeric `.status`. The
  // claude-cli mode surfaces rate-limit / overload through is_error / exit-code
  // / stderr text (it carries `.exitCode`, never `.status`), so without these
  // keywords a subscription user's transient overload would fail the spawn with
  // no retry. Hard caps ("usage limit", "quota exceeded") deliberately do NOT
  // match — retrying a fixed-window cap only delays the failure by the backoff.
  return /\b(timed out|exceeded \d+\s*ms|aborted|overloaded|too many requests|service unavailable|temporarily unavailable|rate[ _-]?limit(ed|ing)?)\b/i.test(
    msg,
  )
}

// ── Invariant §13 Tier 1 — SIGINT/SIGTERM drain registry ───────────────────
//
// spawn.ts's try/finally guarantees spawn.end fires on thrown exceptions, but
// process-level termination signals (SIGINT from Ctrl+C, SIGTERM from kill)
// bypass await-stack unwinding in Bun and Node — the finally never runs.
// Surfaced by GS-5 v1.17.0 self-dogfood: 9 historical unpaired spawn.start
// entries, all openrouter-mode (long HTTP fetch) with llm.request fired but
// no llm.response and no spawn.end. Each "operator hit Ctrl+C waiting for
// the LLM" → one unpaired entry → one Invariant §13 violation.
//
// Fix: track every open spawn in a module-level registry; install a SIGINT/
// SIGTERM handler that drains the registry (emits synthetic spawn.end with
// outcome="interrupted") before re-raising the signal. Registry register/
// deregister is tightly bracketed around the existing try/finally so the
// happy path (and thrown-exception path) cost only a Map insert + delete.

interface OpenSpawnEntry {
  agent: string
  taskId: string | null
  startTs: number
  logger: Logger
  /** STAB-2: child-kill / fetch-abort handle, set lazily once the LLM agent starts. */
  abort?: () => void
}

const openSpawns = new Map<string, OpenSpawnEntry>()
let signalHandlersInstalled = false

function installSignalHandlersOnce(): void {
  if (signalHandlersInstalled) return
  signalHandlersInstalled = true
  const onSignal = (sig: NodeJS.Signals): void => {
    drainOpenSpawnsForSignal(sig)
    // Re-raise with default behavior so the process actually exits. Without
    // this, removing our handler would leave the process running until the
    // next signal. process.exit(128+N) is the conventional shell exit code
    // for signal termination (SIGINT=2 → 130, SIGTERM=15 → 143).
    const code = sig === "SIGINT" ? 130 : sig === "SIGTERM" ? 143 : 1
    process.exit(code)
  }
  process.once("SIGINT", onSignal)
  process.once("SIGTERM", onSignal)
}

function registerOpenSpawn(
  spawnId: string,
  agent: string,
  taskId: string | null,
  startTs: number,
  logger: Logger,
): void {
  installSignalHandlersOnce()
  openSpawns.set(spawnId, { agent, taskId, startTs, logger })
}

function deregisterOpenSpawn(spawnId: string): void {
  openSpawns.delete(spawnId)
}

function drainOpenSpawnsForSignal(signal: string): void {
  for (const [spawnId, e] of openSpawns) {
    // STAB-2: reap the in-flight child / cancel the fetch BEFORE synthesizing
    // the close event, so the process doesn't orphan a claude-cli subprocess
    // (SIGTERM to the parent pid does not propagate to children) or leave a
    // socket dangling. Best-effort — must never block the shutdown drain.
    try {
      e.abort?.()
    } catch {
      // abort handle threw (child already gone, etc.) — keep draining.
    }
    try {
      e.logger.event({
        task_id: e.taskId,
        spawn_id: spawnId,
        agent: e.agent,
        event_type: "spawn.end",
        level: "warn",
        payload: {
          outcome: "interrupted",
          elapsed_ms: Date.now() - e.startTs,
          signal,
        },
      })
    } catch {
      // best-effort during shutdown; don't block exit
    }
  }
  openSpawns.clear()
}

/** Test-only: directly invoke the drain logic without raising a signal. */
export function __drainOpenSpawnsForSignal(signal: string): void {
  drainOpenSpawnsForSignal(signal)
}

/** Test-only: read the current open-spawn count. */
export function __getOpenSpawnCount(): number {
  return openSpawns.size
}

/** Test-only: clear registry between tests (handlers persist; idempotent). */
export function __resetOpenSpawnsForTests(): void {
  openSpawns.clear()
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

// ── Invariant §1 structural gate ────────────────────────────────────────
//
// sgc-invariants.md §1 + sgc-capabilities.yaml `/review.solutions: []`:
// reviewer.* and qa.* agents must remain amnesiac to past solutions.
// review.ts:stripPriorArtSection is the producer-side strip (P3#9 keeps
// it for defense-in-depth); this is the consumer-side structural gate.
//
// Pre-spawn, scan the `intent` input field for either of:
//
//   (A) HTML-comment sentinel pair (current producer format, P3 hardening):
//         <!-- sgc:prior-art:begin -->
//         ...
//         <!-- sgc:prior-art:end -->
//
//   (B) Legacy markdown heading (back-compat — pre-P3 intent.md files are
//       immutable per §2, so this branch must stay):
//         ## Prior art (researcher.history)
//
// Either match throws. Producers MUST wrap in (A); (B) acts as defense-in-
// depth so a refactor regression that drops the sentinel still trips the
// gate. The `(researcher.history)` parenthetical on (B) disambiguates from
// a generic "## Prior art" a user might write in their own motivation.
// Only the `intent`-named string field is scanned — sibling fields like
// `diff` legitimately echo arbitrary code/text (a user's PR may itself
// add a "Prior art" doc heading or even sgc sentinel string) and would
// false-positive a whole-input scan.
//
// Throws SpawnError so spawn.start does NOT fire (§13 Tier 1 paired-event
// contract preserved — failure happens before the spawn is announced).
export const PRIOR_ART_SENTINEL_BEGIN = "<!-- sgc:prior-art:begin -->"
export const PRIOR_ART_SENTINEL_END = "<!-- sgc:prior-art:end -->"
// CE-1 RT-1: planner.adversarial pre-mortem output may carry solution_ref
// strings (when prior_preventions were injected and the LLM marks recurrent
// failure shapes per prompt step 5). The `## Pre-mortem (planner.adversarial)`
// block in intent.md is therefore a second back-channel of solutions content
// into reviewer.* / qa.* and must be stripped at the producer (review.ts)
// AND blocked at the consumer (this gate) — same defense-in-depth pattern
// as the prior-art sentinel.
export const PRE_MORTEM_SENTINEL_BEGIN = "<!-- sgc:pre-mortem:begin -->"
export const PRE_MORTEM_SENTINEL_END = "<!-- sgc:pre-mortem:end -->"
const PRIOR_ART_BACK_CHANNEL_RE =
  /(^|\n)[ \t]*(<!--[ \t]*sgc:prior-art:begin[ \t]*-->|## Prior art \(researcher\.history\))/
const PRE_MORTEM_BACK_CHANNEL_RE =
  /(^|\n)[ \t]*(<!--[ \t]*sgc:pre-mortem:begin[ \t]*-->|## Pre-mortem \(planner\.adversarial\))/

function isReviewerOrQaAgent(name: string): boolean {
  return name.startsWith("reviewer.") || name.startsWith("qa.")
}

export function checkInvariantOneBackChannel(
  agentName: string,
  input: unknown,
): void {
  if (!isReviewerOrQaAgent(agentName)) return
  if (typeof input !== "object" || input === null) return
  const intent = (input as Record<string, unknown>)["intent"]
  if (typeof intent !== "string") return
  if (PRIOR_ART_BACK_CHANNEL_RE.test(intent)) {
    throw new SpawnError(
      `Invariant §1 violation: agent ${agentName} intent input contains a "## Prior art (researcher.history)" back-channel heading — reviewers/qa must remain amnesiac to past solutions. Run stripBackChannelSections on intent.body before spawn (review.ts pattern).`,
    )
  }
  if (PRE_MORTEM_BACK_CHANNEL_RE.test(intent)) {
    throw new SpawnError(
      `Invariant §1 violation: agent ${agentName} intent input contains a "## Pre-mortem (planner.adversarial)" back-channel heading — when CE-1 injects prior_preventions, planner.adversarial output may carry solution_ref strings that must not reach reviewers/qa. Run stripBackChannelSections on intent.body before spawn (review.ts pattern).`,
    )
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
   * STAB-6: max retry attempts for LLM modes (claude-cli / anthropic-sdk /
   * openrouter) on transient errors (429 / 408 / 409 / 5xx / abort-timeout).
   * Default 2. Set 0 to disable.
   */
  llmMaxRetries?: number
  /** Test hook: injectable backoff sleep (default real setTimeout). */
  sleep?: (ms: number) => Promise<void>
  /** Test hook: injectable RNG for jitter (default Math.random). */
  rng?: () => number
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

// Declarative routing table — first non-null `resolve` wins.
//
// P6 rewrite (audit follow-up): the prior implementation was a 10-level
// if-else chain. Each new mode addition required re-auditing every prior
// branch for "would the older logic eat this case?". Declarative form
// makes the priority order explicit and unit-testable per row.
//
// Row resolution rules:
//   - return `null` to defer to the next row
//   - return an AgentMode string to short-circuit
//   - the LAST row MUST always return a string (default fallback)
//
// `reason` is exposed via resolveModeDebug() for trace/audit and CHANGELOG
// review of routing decisions.
interface ModeRoute {
  reason: string
  resolve: (opts: SpawnOptions, manifest?: SubagentManifest) => AgentMode | null
}

const VALID_ENV_MODES: ReadonlySet<AgentMode> = new Set([
  "inline",
  "file-poll",
  "claude-cli",
  "anthropic-sdk",
  "openrouter",
])

const ROUTES: ModeRoute[] = [
  {
    reason: "explicit opts.mode (tests + programmatic embedding)",
    resolve: (opts) => opts.mode ?? null,
  },
  {
    reason: "SGC_AGENT_MODE env override",
    resolve: () => {
      const m = process.env["SGC_AGENT_MODE"] as AgentMode | undefined
      return m && VALID_ENV_MODES.has(m) ? m : null
    },
  },
  {
    reason: "SGC_USE_FILE_AGENTS=1 (legacy alias for file-poll)",
    resolve: () => (process.env["SGC_USE_FILE_AGENTS"] === "1" ? "file-poll" : null),
  },
  {
    reason: "SGC_FORCE_INLINE=1 test escape (forces stubs regardless of keys)",
    resolve: (opts) =>
      process.env["SGC_FORCE_INLINE"] === "1" && opts.inlineStub ? "inline" : null,
  },
  {
    reason: "manifest.prompt_path + ANTHROPIC_API_KEY → anthropic-sdk",
    resolve: (_opts, m) =>
      m?.prompt_path && process.env["ANTHROPIC_API_KEY"] ? "anthropic-sdk" : null,
  },
  {
    reason: "manifest.prompt_path + OPENROUTER_API_KEY → openrouter",
    resolve: (_opts, m) =>
      m?.prompt_path && process.env["OPENROUTER_API_KEY"] ? "openrouter" : null,
  },
  {
    reason: "inline-stub fallback for templateless agents",
    resolve: (opts) => (opts.inlineStub ? "inline" : null),
  },
  {
    reason: "ANTHROPIC_API_KEY catch-all (templateless agents without stub)",
    resolve: () => (process.env["ANTHROPIC_API_KEY"] ? "anthropic-sdk" : null),
  },
  {
    reason: "OPENROUTER_API_KEY catch-all",
    resolve: () => (process.env["OPENROUTER_API_KEY"] ? "openrouter" : null),
  },
  {
    reason: "`claude` CLI in PATH (subscription-friendly)",
    resolve: (opts) => {
      const hasCli = opts.hasClaudeCli ?? (() => whichSync("claude") !== null)
      return hasCli() ? "claude-cli" : null
    },
  },
  {
    reason: "default file-poll",
    resolve: () => "file-poll",
  },
]

/**
 * Resolve which agent dispatch mode to use. See {@link ROUTES} for the
 * declarative priority table. Exported for direct testing.
 */
export function resolveMode(opts: SpawnOptions = {}, manifest?: SubagentManifest): AgentMode {
  for (const route of ROUTES) {
    const m = route.resolve(opts, manifest)
    if (m) return m
  }
  // Unreachable: last route always returns "file-poll". TS doesn't know that.
  return "file-poll"
}

/**
 * Debug variant — returns the resolved mode AND the matching route's reason.
 * Useful for logging / `sgc doctor` diagnostics / trace output.
 */
export function resolveModeDebug(
  opts: SpawnOptions = {},
  manifest?: SubagentManifest,
): { mode: AgentMode; reason: string } {
  for (const route of ROUTES) {
    const m = route.resolve(opts, manifest)
    if (m) return { mode: m, reason: route.reason }
  }
  return { mode: "file-poll", reason: "default file-poll" }
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
    let template: string
    try {
      template = readPrompt(manifest.prompt_path)
    } catch {
      throw new SpawnError(
        `prompt_path declared (${manifest.prompt_path}) but file does not exist for agent ${manifest.name}`,
      )
    }
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

  // Invariant §1 structural gate (P3#9): reviewer.* / qa.* inputs must not
  // contain Prior-art back-channels (## Prior art heading, solution_ref
  // field). Throws SpawnError before spawn.start fires — paired-event
  // contract preserved per §13 Tier 1 (no spawn.start ⇒ no spawn.end
  // owed). Producer-side strip in review.ts:stripPriorArtSection stays
  // for defense-in-depth.
  checkInvariantOneBackChannel(agentName, input)

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

  // P3#10: file-poll auto-deactivate inside a Claude Code session.
  // file-poll waits for an external actor (human / Claude in a parent
  // session) to write the result file via `sgc agent-loop --submit`.
  // When the dispatcher is invoked from within an active Claude Code
  // session (CLAUDE_PLUGIN_ROOT set by the Claude Code runtime when
  // executing plugin hooks/skills/commands), the spawn would block
  // forever — Claude has Task() and doesn't need the prompt/result
  // file-handshake. Fail fast with a Task()-shaped hint instead.
  //
  // Thrown before spawn.start fires → §13 Tier 1 paired-event contract
  // preserved (no spawn.start ⇒ no spawn.end owed).
  if (mode === "file-poll" && process.env["CLAUDE_PLUGIN_ROOT"]) {
    throw new SpawnError(
      `Agent ${agentName}: file-poll mode is disabled inside Claude Code sessions ` +
        `(CLAUDE_PLUGIN_ROOT detected). Options: ` +
        `(1) unset SGC_USE_FILE_AGENTS to use inline/anthropic-sdk/openrouter modes; ` +
        `(2) set ANTHROPIC_API_KEY or OPENROUTER_API_KEY for direct LLM dispatch; ` +
        `(3) invoke the agent via Task("${agentName}", input) from your Claude session, ` +
        `then submit the YAML output via \`sgc agent-loop --submit ${spawnId} --from <file>\`. ` +
        `Prompt written to: ${promptPath}`,
    )
  }

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
  // Register for SIGINT/SIGTERM drain; deregistered in finally below. Signal
  // handlers are installed lazily on first registration (idempotent).
  registerOpenSpawn(spawnId, agentName, opts.taskId ?? null, startTs, logger)

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
    // STAB-6: LLM modes retry transient failures (429 / 5xx / abort-timeout)
    // with bounded exponential backoff. Default 2 retries; opt out with 0.
    const llmRetry = {
      maxRetries: opts.llmMaxRetries ?? 2,
      isRetryable: isTransientLlmError,
      sleep: opts.sleep,
      rng: opts.rng,
    }
    // STAB-2: shared LLM context — registerAbort stores the child-kill / fetch-
    // abort handle in this spawn's registry entry so a signal drain can reap it.
    const llmCtx: LlmAgentContext = {
      spawnId,
      taskId: opts.taskId ?? null,
      agentName,
      logger,
      registerAbort: (abort) => {
        const e = openSpawns.get(spawnId)
        if (e) e.abort = abort
      },
    }
    if (mode === "inline" && opts.inlineStub) {
      output = await opts.inlineStub(input)
      writeAtomic(
        resultPath,
        serializeFrontmatter(output as Record<string, unknown>, ""),
      )
    } else if (mode === "claude-cli") {
      output = await retryWithBackoff(
        () => runClaudeCliAgent(promptPath, manifest, opts.claudeCliRunner, llmCtx),
        llmRetry,
      )
      writeAtomic(
        resultPath,
        serializeFrontmatter(output as Record<string, unknown>, ""),
      )
    } else if (mode === "anthropic-sdk") {
      output = await retryWithBackoff(
        () =>
          runAnthropicSdkAgent(promptPath, manifest, opts.anthropicClientFactory, llmCtx),
        llmRetry,
      )
      writeAtomic(
        resultPath,
        serializeFrontmatter(output as Record<string, unknown>, ""),
      )
    } else if (mode === "openrouter") {
      output = await retryWithBackoff(
        () => runOpenRouterAgent(promptPath, manifest, opts.openRouterFetch, llmCtx),
        llmRetry,
      )
      writeAtomic(
        resultPath,
        serializeFrontmatter(output as Record<string, unknown>, ""),
      )
    } else {
      // file-poll with timeout clamp + optional retry (shared backoff helper).
      const rawTimeoutMs = opts.timeoutMs ?? (manifest.timeout_s ?? 60) * 1000
      const timeoutMs = clampTimeout(rawTimeoutMs)
      output = await retryWithBackoff(
        () =>
          pollForResult(resultPath, timeoutMs, opts.pollIntervalMs ?? 1000),
        {
          maxRetries: opts.maxRetries ?? 0,
          isRetryable: (e) => e instanceof SpawnTimeout,
          sleep: opts.sleep,
          rng: opts.rng,
        },
      )
    }

    validateOutputShape(manifest, output)

    // P2 — Invariant §1 OUTPUT-side leak check. §1 + §8 are advisory in
    // LLM modes (the LLM with shell-tool access can sidestep its pinned
    // scope and `cat .sgc/solutions/*.md`). validateOutputShape rejects
    // undeclared fields (§9) but cannot inspect VALUE content; this scan
    // catches reviewer.* / qa.* output that quotes lines from solutions. The check
    // runs in ALL modes (defense-in-depth — an inline stub regression that
    // started reading solutions would also trip here). Empty solutions/ or
    // non-reviewer/qa agent → no-op.
    const leak = scanOutputForLeak(
      agentName,
      output,
      getFingerprintsCached(stateRoot),
    )
    if (leak.hit) {
      throw new SpawnError(
        `Invariant §1 violation (output leak): agent ${agentName} output contains ${leak.count} line(s) matching solutions/ content. ` +
          `Sample(s): ${leak.samples.map((s) => `"${s}"`).join(", ")}. ` +
          `The LLM likely accessed solutions/ outside its pinned scope (§8). ` +
          `See sgc-invariants.md §1 + sgc-capabilities.yaml /review.solutions=[].`,
      )
    }

    // P2-1: non-blocking banned-vocab lint on output (warn-only, never rejects
    // — a false positive must not break a valid plan/review). Surfaces in the
    // §13 event stream (`sgc tail --event-type output.banned_vocab`) so a
    // guardrail-ignoring LLM is visible without failing the spawn.
    const bannedTerms = detectBannedVocab(JSON.stringify(output))
    if (bannedTerms.length > 0) {
      logger.event({
        task_id: opts.taskId ?? null,
        spawn_id: spawnId,
        agent: agentName,
        event_type: "output.banned_vocab",
        level: "warn",
        payload: { terms: bannedTerms.slice(0, 10), count: bannedTerms.length },
      })
    }

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
    deregisterOpenSpawn(spawnId)
  }
}
