// Anthropic SDK agent mode: direct API calls via @anthropic-ai/sdk.
//
// Activated automatically when ANTHROPIC_API_KEY is set in the environment.
// Cannot be used by subscription-only users (Anthropic's ToS as of 2026-02
// prohibits subscription OAuth tokens with SDK calls — see claude-cli-agent
// for the subscription path).
//
// Prompt caching strategy:
//   - System block = manifest-derived stable prefix (purpose + expected-output
//     schema + reply-format guidance). Cached via cache_control: ephemeral.
//     Keyed by manifest body content; byte-identical across calls for the
//     same agent, so the cache actually hits. See formatPrompt in spawn.ts
//     for the layout contract.
//   - User block = per-call varying content (frontmatter with spawn_id +
//     computed scope_tokens, scope reminder, task input YAML, resultPath).
//     Not cached — every field here changes per spawn.
//   - Split marker: `## Input` heading at start of a line. splitPrompt
//     tolerates CRLF/LF line endings and trailing whitespace on the heading.
//   - Fallback: no `## Input` heading → whole prompt stays in the user block
//     and no system block is emitted (preserves legacy behavior for any
//     external caller passing a non-conforming prompt file).
//
// Other defaults (per Anthropic's current best-practice guidance, 2026-04):
//   - model: claude-opus-4-6
//   - thinking: { type: "adaptive" } — Claude picks depth per request
//   - typed exception handling via Anthropic.APIError subclasses

import { readFileSync } from "node:fs"
import { load as yamlLoad } from "js-yaml"
import Anthropic from "@anthropic-ai/sdk"
import { extractYamlBody } from "./claude-cli-agent"
import type { SubagentManifest } from "./types"
import type { LlmAgentContext, LlmRequestPayload, LlmResponsePayload } from "./logger"

export class AnthropicSdkError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message)
    this.name = "AnthropicSdkError"
  }
}

/** Factory injected by tests to return a mock client. */
export type AnthropicClientFactory = () => Pick<Anthropic, "messages">

const DEFAULT_MODEL = "claude-opus-4-6"
/**
 * Cap max_tokens per response. Manifests declare token_budget but some are
 * generous (e.g. compound.context = 5000). We clamp to keep responses
 * bounded and non-streaming-safe per the SDK HTTP timeout.
 */
const MAX_TOKENS_CAP = 8192

// OpenRouter support moved to openrouter-agent.ts (uses chat/completions format,
// not Anthropic Messages API). This file only handles direct Anthropic API calls.

/**
 * Split a prompt into stable (system) and variable (user) portions.
 *
 * System = everything up to the `## Input` heading (manifest-derived: purpose,
 * expected output schema, reply-format guidance). This is the cache-stable
 * prefix.
 *
 * User = the `## Input` section onward (per-call: frontmatter with spawn_id
 * + scope_tokens, scope reminder, task input YAML, resultPath).
 *
 * Marker tolerates CRLF vs LF line endings and trailing whitespace on the
 * heading line. Matches only `## Input` (level-2 heading), not `### Input`
 * or `#### Input` — those are subheadings inside the user block in the
 * current layout.
 *
 * First match wins if the marker appears multiple times (not expected in
 * the current layout, but documented for safety).
 *
 * Both halves are trimmed. Fallback: no marker found → `systemPart: ""` and
 * whole prompt returned as `userPart` (preserves legacy behavior for
 * non-conforming prompt files).
 */
export function splitPrompt(text: string): { systemPart: string; userPart: string } {
  const markerRe = /\r?\n##[ \t]+Input[ \t]*\r?\n/
  const match = markerRe.exec(text)
  if (!match) {
    return { systemPart: "", userPart: text }
  }
  return {
    systemPart: text.slice(0, match.index).trim(),
    userPart: text.slice(match.index).trim(),
  }
}

export async function runAnthropicSdkAgent(
  promptPath: string,
  manifest: SubagentManifest,
  clientFactory?: AnthropicClientFactory,
  ctx?: LlmAgentContext,
): Promise<unknown> {
  const promptText = readFileSync(promptPath, "utf8")
  const { systemPart, userPart } = splitPrompt(promptText)
  const client = clientFactory ? clientFactory() : new Anthropic()

  const maxTokens = Math.min(manifest.token_budget ?? 4096, MAX_TOKENS_CAP)
  const timeoutMs = (manifest.timeout_s ?? 60) * 1000
  const model = DEFAULT_MODEL

  if (ctx) {
    const reqPayload: LlmRequestPayload = {
      model,
      prompt_chars: promptText.length,
      cached_prefix_chars: systemPart.length > 0 ? systemPart.length : undefined,
      mode: "anthropic-sdk",
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
  let response: Anthropic.Message
  let outcome: LlmResponsePayload["outcome"] = "error"
  let errorClass: string | undefined
  let usageInput: number | undefined
  let usageOutput: number | undefined
  let usageCacheRead: number | undefined
  let usageCacheCreation: number | undefined

  const emitResponse = (): void => {
    if (!ctx) return
    const resPayload: LlmResponsePayload = {
      outcome,
      latency_ms: Date.now() - startTs,
      ...(usageInput !== undefined ? { input_tokens: usageInput } : {}),
      ...(usageOutput !== undefined ? { output_tokens: usageOutput } : {}),
      ...(usageCacheRead !== undefined ? { cache_read_tokens: usageCacheRead } : {}),
      ...(usageCacheCreation !== undefined ? { cache_creation_tokens: usageCacheCreation } : {}),
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

  try {
    const createArgs: Anthropic.MessageCreateParamsNonStreaming = {
      model,
      max_tokens: maxTokens,
      thinking: { type: "adaptive" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userPart,
            },
          ],
        },
      ],
    }
    // Only set system when we actually have a stable prefix to cache.
    // Empty systemPart → fallback behavior (whole prompt in user, no caching).
    if (systemPart.length > 0) {
      createArgs.system = [
        {
          type: "text",
          text: systemPart,
          cache_control: { type: "ephemeral" },
        },
      ]
    }
    response = await (client.messages.create as typeof Anthropic.prototype.messages.create)(
      createArgs,
      { timeout: timeoutMs },
    )
    outcome = "success"
    const u = response.usage as {
      input_tokens?: number
      output_tokens?: number
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
    } | undefined
    usageInput = u?.input_tokens
    usageOutput = u?.output_tokens
    usageCacheRead = u?.cache_read_input_tokens
    usageCacheCreation = u?.cache_creation_input_tokens
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      errorClass = `APIError-${e.status ?? "?"}`
      emitResponse()
      throw new AnthropicSdkError(
        `Anthropic API error ${e.status ?? "?"} for ${manifest.name}: ${e.message}`,
        e.status,
      )
    }
    errorClass = e instanceof Error ? e.name : "unknown"
    emitResponse()
    throw e
  }

  emitResponse()

  const textBlock = response.content.find((b) => b.type === "text")
  if (!textBlock || textBlock.type !== "text") {
    throw new AnthropicSdkError(
      `no text block in response for ${manifest.name} (blocks: ${response.content.map((b) => b.type).join(", ")})`,
    )
  }

  const yamlBody = extractYamlBody(textBlock.text)
  let data: unknown
  try {
    data = yamlLoad(yamlBody)
  } catch (e) {
    throw new AnthropicSdkError(
      `SDK YAML parse failed for ${manifest.name}: ${String(e).slice(0, 200)}`,
    )
  }
  if (typeof data !== "object" || data === null) {
    throw new AnthropicSdkError(
      `SDK response YAML not an object for ${manifest.name}: got ${typeof data}`,
    )
  }
  return data
}
