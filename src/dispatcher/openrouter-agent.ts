// OpenRouter agent mode: API calls via fetch to OpenRouter's chat/completions endpoint.
//
// Activated when OPENROUTER_API_KEY is set (and ANTHROPIC_API_KEY is not).
// OpenRouter uses OpenAI-compatible chat/completions format, not Anthropic Messages.
// This module translates: Anthropic-shaped prompt → OpenAI chat request → parse response.
//
// Model mapping: bare Anthropic model IDs (e.g. "claude-opus-4-6") are prefixed
// with "anthropic/" for OpenRouter's routing.

import { readFileSync } from "node:fs"
import { load as yamlLoad } from "js-yaml"
import { splitPrompt } from "./anthropic-sdk-agent"
import { proxyAwareFetch } from "./proxy-fetch"
import type { SubagentManifest } from "./types"
import type { LlmAgentContext, LlmRequestPayload, LlmResponsePayload } from "./logger"

export class OpenRouterError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message)
    this.name = "OpenRouterError"
  }
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
// Latest Anthropic Opus on OpenRouter as of the 1.2.x default bump (2026-05).
// Calibration of CI-skip eval tests (researcher-history, planner-eng,
// compound-context, reviewer-correctness, classifier) was done against
// `anthropic/claude-sonnet-4`; if you need that calibration set
// SGC_OPENROUTER_MODEL=anthropic/claude-sonnet-4. If your OpenRouter region
// hasn't rolled out 4.7 yet, fall back to `anthropic/claude-opus-4.5` or
// `anthropic/claude-sonnet-4.6` via the same env override.
const DEFAULT_MODEL = "anthropic/claude-opus-4.7"
const MAX_TOKENS_CAP = 8192

/**
 * P2-11: disclose third-party egress at runtime, once per process.
 *
 * Setting OPENROUTER_API_KEY auto-activates this mode (spawn.ts's ROUTES
 * ladder), and every subagent's prompt — task input YAML, i.e. the user's
 * diffs and source — is POSTed to openrouter.ai. That was documented only in
 * this file's header comment, which is not where anyone is looking when they
 * export a key into a shell profile and forget about it months later. For a
 * tool that exists to review proprietary code, silent egress on a stale env var
 * is a default that has to speak up.
 *
 * stderr, not stdout: `--json` consumers must stay parseable. Once per process:
 * a per-spawn line would be noise the operator learns to ignore.
 */
let egressNoticeShown = false

function noticeThirdPartyEgress(model: string): void {
  if (egressNoticeShown) return
  egressNoticeShown = true
  console.error(
    `[sgc] OPENROUTER_API_KEY is set → subagents run on openrouter.ai (model: ${model}). ` +
      `Prompt content (your task text, code and diffs) is sent to that third party. ` +
      `Unset OPENROUTER_API_KEY, or set SGC_FORCE_INLINE=1, to keep everything local.`,
  )
}

/** Test-only: re-arm the once-per-process notice. */
export function __resetEgressNoticeForTests(): void {
  egressNoticeShown = false
}

/**
 * Extract a YAML body from an LLM response, with layered recovery so a model
 * that drops the language tag or omits a closing fence does not hard-fail
 * (P2-1 audit: OpenRouter parsing had no recovery path).
 * Exported for unit testing.
 */
export function extractYamlBlock(text: string): string {
  // 1. Preferred: an explicitly tagged ```yaml / ```yml fence.
  const tagged = text.match(/```ya?ml\s*\n([\s\S]*?)```/)
  if (tagged) return tagged[1]!.trim()
  // 2. Recovery: a generic fenced block (model dropped the `yaml` tag, or used
  //    ```json / ``` ) — the most common real failure mode.
  const generic = text.match(/```[^\n]*\n([\s\S]*?)```/)
  if (generic) return generic[1]!.trim()
  // 3. Recovery: an unterminated / fence-less response — strip any stray fence
  //    lines and hand the remainder to the YAML parser.
  return text
    .split("\n")
    .filter((l) => !/^\s*```/.test(l))
    .join("\n")
    .trim()
}

export type OpenRouterFetch = (url: string, init: RequestInit) => Promise<Response>

export async function runOpenRouterAgent(
  promptPath: string,
  manifest: SubagentManifest,
  fetchFn?: OpenRouterFetch,
  ctx?: LlmAgentContext,
): Promise<unknown> {
  const apiKey = process.env["OPENROUTER_API_KEY"]
  if (!apiKey) {
    throw new OpenRouterError("OPENROUTER_API_KEY not set")
  }

  const promptText = readFileSync(promptPath, "utf8")
  const { systemPart, userPart } = splitPrompt(promptText)
  const maxTokens = Math.min(manifest.token_budget ?? 4096, MAX_TOKENS_CAP)
  const timeoutMs = (manifest.timeout_s ?? 60) * 1000

  const messages: Array<{ role: string; content: string }> = []
  if (systemPart.length > 0) {
    messages.push({ role: "system", content: systemPart })
  }
  messages.push({ role: "user", content: userPart })

  const model = process.env["SGC_OPENROUTER_MODEL"] ?? DEFAULT_MODEL
  // P2-11: say out loud that this prompt is leaving for a third party.
  noticeThirdPartyEgress(model)

  const body = {
    model,
    max_tokens: maxTokens,
    messages,
  }

  // Invariant §13 Tier 2: emit llm.request before fetch
  if (ctx) {
    const reqPayload: LlmRequestPayload = {
      model,
      prompt_chars: promptText.length,
      cached_prefix_chars: systemPart.length > 0 ? systemPart.length : undefined,
      mode: "openrouter",
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

  const doFetch = fetchFn ?? proxyAwareFetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  // STAB-2: let a signal drain cancel this in-flight fetch instead of leaving
  // the socket dangling until process teardown.
  ctx?.registerAbort?.(() => controller.abort())

  const startTs = Date.now()
  // Declared before emitResponse so the drain-registered closer (below) can set
  // them; `outcome` is what the closer overwrites with "interrupted".
  let outcome: LlmResponsePayload["outcome"] = "error"
  let errorClass: string | undefined
  let usageInput: number | undefined
  let usageOutput: number | undefined

  // P2-4: §13 Tier 2 must fire exactly once per llm.request — the signal drain
  // may close this call concurrently with the agent's own error path.
  let responded = false
  const emitResponse = (): void => {
    if (!ctx || responded) return
    responded = true
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

  // P2-4: let a signal drain close Tier 2 for this in-flight request. The
  // once-guard above makes it a no-op if we already answered.
  ctx?.registerLlmClose?.((oc) => {
    outcome = oc
    errorClass ??= "interrupted"
    emitResponse()
  })

  let response: Response
  try {
    response = await doFetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://github.com/sdsrss/sgc",
        "X-Title": "sgc-dispatcher",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (e: any) {
    if (e.name === "AbortError") {
      outcome = "timeout"
      errorClass = "AbortError"
      emitResponse()
      throw new OpenRouterError(`OpenRouter request timed out after ${timeoutMs}ms for ${manifest.name}`)
    }
    errorClass = e?.name ?? "unknown"
    emitResponse()
    throw new OpenRouterError(`OpenRouter fetch failed for ${manifest.name}: ${e.message}`)
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    errorClass = `HTTPError-${response.status}`
    emitResponse()
    const errorText = await response.text().catch(() => "(unreadable)")
    throw new OpenRouterError(
      `OpenRouter ${response.status} for ${manifest.name}: ${errorText.slice(0, 200)}`,
      response.status,
    )
  }

  const json = await response.json() as any
  const content = json?.choices?.[0]?.message?.content
  if (typeof content !== "string" || content.trim() === "") {
    errorClass = "MissingContent"
    emitResponse()
    throw new OpenRouterError(
      `OpenRouter returned no content for ${manifest.name}: ${JSON.stringify(json).slice(0, 200)}`,
    )
  }

  // Success — extract usage before success emission
  const u = json?.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined
  usageInput = u?.prompt_tokens
  usageOutput = u?.completion_tokens
  outcome = "success"
  emitResponse()

  // YAML parsing errors are downstream of the LLM call — keep them unchanged.
  const yamlBody = extractYamlBlock(content)
  let data: unknown
  try {
    data = yamlLoad(yamlBody)
  } catch (e) {
    throw new OpenRouterError(
      `OpenRouter YAML parse failed for ${manifest.name}: ${String(e).slice(0, 200)}`,
    )
  }
  if (typeof data !== "object" || data === null) {
    throw new OpenRouterError(
      `OpenRouter response YAML not an object for ${manifest.name}: got ${typeof data}`,
    )
  }
  return data
}
