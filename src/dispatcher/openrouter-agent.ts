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
import type { SubagentManifest } from "./types"
import type { LlmAgentContext, LlmRequestPayload, LlmResponsePayload } from "./logger"

export class OpenRouterError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message)
    this.name = "OpenRouterError"
  }
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
const DEFAULT_MODEL = "anthropic/claude-sonnet-4"
const MAX_TOKENS_CAP = 8192

/** Extract ```yaml ... ``` fenced block from response text. */
function extractYamlBlock(text: string): string {
  const fenced = text.match(/```ya?ml\s*\n([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  // Fallback: try to parse the whole text as YAML
  return text.trim()
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

  const model = DEFAULT_MODEL

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

  const doFetch = fetchFn ?? globalThis.fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

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
