// Shell-out agent mode: invoke the local `claude -p` CLI binary.
//
// Works for **Claude subscription users** (Pro/Max via claude.ai) — no
// ANTHROPIC_API_KEY needed; `claude` uses whatever auth state the user
// has configured locally (via `claude login` or Claude Code's stored
// credentials).
//
// Why not Anthropic SDK / Claude Agent SDK?
//   Anthropic explicitly prohibits using subscription OAuth tokens with
//   those SDKs (ToS as of 2026-02). Subscription users must go through
//   `claude` CLI or file-poll.
//
// Tradeoffs:
//   + Zero API key management
//   + Automation without copy-paste (vs file-poll)
//   − Relies on local `claude` auth state; may prompt re-login
//   − No direct prompt-caching control from our side (the `claude`
//     binary handles it opaquely; we observe hits via `usage` but
//     can't explicitly cache-block)
//
// Usage: set env `SGC_AGENT_MODE=claude-cli` before running `sgc plan`
// or any other command that spawns agents.

import { readFileSync } from "node:fs"
import { load as yamlLoad } from "js-yaml"
import type { SubagentManifest } from "./types"
import type { LlmAgentContext, LlmRequestPayload, LlmResponsePayload } from "./logger"

export class ClaudeCliError extends Error {
  constructor(
    message: string,
    public readonly stderr?: string,
    public readonly exitCode?: number,
  ) {
    super(message)
    this.name = "ClaudeCliError"
  }
}

export interface SubprocessRunner {
  (argv: string[], timeoutMs: number): Promise<{
    stdout: string
    stderr: string
    exitCode: number
    timedOut: boolean
  }>
}

/** Default runner: Bun.spawn. Split out so tests can inject a fake. */
export const defaultRunner: SubprocessRunner = async (argv, timeoutMs) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let timedOut = false
  try {
    const proc = Bun.spawn(argv, {
      stdout: "pipe",
      stderr: "pipe",
      signal: controller.signal,
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    return { stdout, stderr, exitCode, timedOut }
  } catch (e) {
    // AbortController.abort() surfaces as "The operation was aborted" or similar
    if (controller.signal.aborted) {
      timedOut = true
      return { stdout: "", stderr: String(e), exitCode: -1, timedOut }
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Extract YAML body from the `claude -p` result field. The model typically
 * wraps YAML in a markdown code fence; we try fenced first, then bare.
 */
export function extractYamlBody(resultText: string): string {
  const fenced = /```(?:yaml|yml)?\s*\n([\s\S]*?)\n```/.exec(resultText)
  if (fenced) return fenced[1]!.trim()
  // Try frontmatter fence
  const fm = /^---\n([\s\S]*?)\n---/.exec(resultText.trim())
  if (fm) return fm[1]!.trim()
  return resultText.trim()
}

/**
 * Shape of the JSON emitted by `claude -p --output-format json`.
 * Kept permissive — fields may be renamed between claude versions.
 */
export interface ClaudeCliJson {
  type?: string
  subtype?: string
  is_error?: boolean
  result?: string
  stop_reason?: string
  usage?: Record<string, unknown>
  total_cost_usd?: number
  [k: string]: unknown
}

/**
 * Run the `claude -p` CLI against a pre-written prompt file and parse the
 * model's YAML response back into an object. Throws ClaudeCliError on
 * any failure (non-zero exit, timeout, is_error=true, invalid YAML).
 */
export async function runClaudeCliAgent(
  promptPath: string,
  manifest: SubagentManifest,
  runner: SubprocessRunner = defaultRunner,
  ctx?: LlmAgentContext,
): Promise<unknown> {
  const promptText = readFileSync(promptPath, "utf8")
  const timeoutMs = (manifest.timeout_s ?? 60) * 1000

  const argv = ["claude", "-p", "--output-format", "json", promptText]

  // CLI doesn't expose model ID in request; use mode name as placeholder
  const model = "claude-cli"

  if (ctx) {
    const reqPayload: LlmRequestPayload = {
      model,
      prompt_chars: promptText.length,
      mode: "claude-cli",
    }
    ctx.logger.event({
      task_id: ctx.taskId,
      spawn_id: ctx.spawnId,
      agent: ctx.agentName,
      event_type: "llm.request",
      level: "info",
      payload: reqPayload as unknown as Record<string, unknown>,
    })
  }

  const startTs = Date.now()
  let outcome: LlmResponsePayload["outcome"] = "error"
  let errorClass: string | undefined
  let usageInput: number | undefined
  let usageOutput: number | undefined

  const emitResponse = (): void => {
    if (!ctx) return
    const resPayload: LlmResponsePayload = {
      outcome,
      latency_ms: Date.now() - startTs,
      ...(usageInput !== undefined ? { input_tokens: usageInput } : {}),
      ...(usageOutput !== undefined ? { output_tokens: usageOutput } : {}),
      ...(errorClass ? { error_class: errorClass } : {}),
    }
    ctx.logger.event({
      task_id: ctx.taskId,
      spawn_id: ctx.spawnId,
      agent: ctx.agentName,
      event_type: "llm.response",
      level: outcome === "success" ? "info" : "warn",
      payload: resPayload as unknown as Record<string, unknown>,
    })
  }

  const { stdout, stderr, exitCode, timedOut } = await runner(argv, timeoutMs)

  if (timedOut) {
    outcome = "timeout"
    errorClass = "ClaudeCliTimeout"
    emitResponse()
    throw new ClaudeCliError(
      `claude CLI exceeded ${timeoutMs}ms for ${manifest.name}`,
      stderr,
      exitCode,
    )
  }
  if (exitCode !== 0) {
    errorClass = `ExitCode-${exitCode}`
    emitResponse()
    throw new ClaudeCliError(
      `claude CLI exit ${exitCode} for ${manifest.name}: ${stderr.slice(0, 200)}`,
      stderr,
      exitCode,
    )
  }

  let parsed: ClaudeCliJson
  try {
    parsed = JSON.parse(stdout) as ClaudeCliJson
  } catch (e) {
    errorClass = "NonJSONOutput"
    emitResponse()
    throw new ClaudeCliError(
      `claude CLI returned non-JSON for ${manifest.name}: ${stdout.slice(0, 200)}`,
    )
  }

  if (parsed.is_error) {
    errorClass = "IsError"
    emitResponse()
    throw new ClaudeCliError(
      `claude CLI reported error for ${manifest.name}: ${parsed.result ?? "(no detail)"}`,
    )
  }

  const resultText = parsed.result
  if (typeof resultText !== "string") {
    errorClass = "MissingResult"
    emitResponse()
    throw new ClaudeCliError(
      `claude CLI response missing .result string for ${manifest.name}`,
    )
  }

  // At this point the CLI call succeeded. Extract usage + emit response.
  const u = parsed.usage as { input_tokens?: number; output_tokens?: number } | undefined
  usageInput = u?.input_tokens
  usageOutput = u?.output_tokens
  outcome = "success"
  emitResponse()

  // YAML parse errors stay downstream (spawn.end Tier 1 covers via catch)
  const yamlBody = extractYamlBody(resultText)
  let data: unknown
  try {
    data = yamlLoad(yamlBody)
  } catch (e) {
    throw new ClaudeCliError(
      `claude CLI YAML parse failed for ${manifest.name}: ${String(e).slice(0, 200)}`,
    )
  }
  if (typeof data !== "object" || data === null) {
    throw new ClaudeCliError(
      `claude CLI output not a YAML object for ${manifest.name}: got ${typeof data}`,
    )
  }
  return data
}
