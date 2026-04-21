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

/**
 * Create the default Anthropic client with automatic key/baseURL resolution:
 *   1. ANTHROPIC_API_KEY → direct Anthropic API (default)
 *   2. OPENROUTER_API_KEY → OpenRouter proxy (Anthropic Messages API compatible)
 *   3. Neither → Anthropic() constructor throws (caller should have checked)
 */
function createDefaultClient(): Anthropic {
  const openRouterKey = process.env["OPENROUTER_API_KEY"]
  if (openRouterKey && !process.env["ANTHROPIC_API_KEY"]) {
    return new Anthropic({
      apiKey: openRouterKey,
      baseURL: "https://openrouter.ai/api/v1",
    })
  }
  return new Anthropic()
}

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
): Promise<unknown> {
  const promptText = readFileSync(promptPath, "utf8")
  const { systemPart, userPart } = splitPrompt(promptText)
  const client = clientFactory ? clientFactory() : createDefaultClient()

  const maxTokens = Math.min(manifest.token_budget ?? 4096, MAX_TOKENS_CAP)
  const timeoutMs = (manifest.timeout_s ?? 60) * 1000

  let response: Anthropic.Message
  try {
    const createArgs: Anthropic.MessageCreateParamsNonStreaming = {
      model: DEFAULT_MODEL,
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
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      throw new AnthropicSdkError(
        `Anthropic API error ${e.status ?? "?"} for ${manifest.name}: ${e.message}`,
        e.status,
      )
    }
    throw e
  }

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
