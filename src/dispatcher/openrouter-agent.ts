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

  const body = {
    model: DEFAULT_MODEL,
    max_tokens: maxTokens,
    messages,
  }

  const doFetch = fetchFn ?? globalThis.fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

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
      throw new OpenRouterError(`OpenRouter request timed out after ${timeoutMs}ms for ${manifest.name}`)
    }
    throw new OpenRouterError(`OpenRouter fetch failed for ${manifest.name}: ${e.message}`)
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "(unreadable)")
    throw new OpenRouterError(
      `OpenRouter ${response.status} for ${manifest.name}: ${errorText.slice(0, 200)}`,
      response.status,
    )
  }

  const json = await response.json() as any
  const content = json?.choices?.[0]?.message?.content
  if (typeof content !== "string" || content.trim() === "") {
    throw new OpenRouterError(
      `OpenRouter returned no content for ${manifest.name}: ${JSON.stringify(json).slice(0, 200)}`,
    )
  }

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
