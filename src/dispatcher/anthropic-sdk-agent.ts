// Anthropic SDK agent mode: direct API calls via @anthropic-ai/sdk.
//
// Activated automatically when ANTHROPIC_API_KEY is set in the environment.
// Cannot be used by subscription-only users (Anthropic's ToS as of 2026-02
// prohibits subscription OAuth tokens with SDK calls — see claude-cli-agent
// for the subscription path).
//
// Defaults (per Anthropic's current best-practice guidance, 2026-04):
//   - model: claude-opus-4-6
//   - thinking: { type: "adaptive" } — Claude picks depth per request
//   - prompt caching: ephemeral on the user-message content block
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

export async function runAnthropicSdkAgent(
  promptPath: string,
  manifest: SubagentManifest,
  clientFactory?: AnthropicClientFactory,
): Promise<unknown> {
  const promptText = readFileSync(promptPath, "utf8")
  const client = clientFactory ? clientFactory() : new Anthropic()

  const maxTokens = Math.min(manifest.token_budget ?? 4096, MAX_TOKENS_CAP)
  const timeoutMs = (manifest.timeout_s ?? 60) * 1000

  let response: Anthropic.Message
  try {
    response = await (client.messages.create as typeof Anthropic.prototype.messages.create)(
      {
        model: DEFAULT_MODEL,
        max_tokens: maxTokens,
        thinking: { type: "adaptive" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: promptText,
                cache_control: { type: "ephemeral" },
              },
            ],
          },
        ],
      },
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
