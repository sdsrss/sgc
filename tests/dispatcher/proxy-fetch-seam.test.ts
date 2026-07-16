// C11 seam guard: the OpenRouter agent and the canary health-check must DEFAULT
// to proxyAwareFetch (not raw globalThis.fetch). The rest of the openrouter/canary
// suites inject their own fetch and so never exercise the default — a regression
// reverting either seam to globalThis.fetch would pass every other test while
// silently killing proxy support. These drive the real default path with a
// stubbed globalThis.fetch + HTTPS_PROXY and assert the outbound request carried
// an undici dispatcher.

import { test, expect } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ProxyAgent } from "undici"
import { runOpenRouterAgent } from "../../src/dispatcher/openrouter-agent"
import { runCanaryChecks } from "../../src/dispatcher/canary"
import type { SubagentManifest } from "../../src/dispatcher/types"

type CapturedInit = (RequestInit & { dispatcher?: unknown }) | undefined

function setEnv(key: string, value: string): string | undefined {
  const prev = process.env[key]
  process.env[key] = value
  return prev
}
function restoreEnv(key: string, prev: string | undefined): void {
  if (prev === undefined) delete process.env[key]
  else process.env[key] = prev
}

test("openrouter agent defaults to proxyAwareFetch (dispatcher attached under HTTPS_PROXY)", async () => {
  const origFetch = globalThis.fetch
  const prevKey = setEnv("OPENROUTER_API_KEY", "test-key")
  const prevProxy = setEnv("HTTPS_PROXY", "http://127.0.0.1:19990")
  const dir = mkdtempSync(join(tmpdir(), "sgc-proxyseam-or-"))
  const promptPath = join(dir, "prompt.md")
  writeFileSync(promptPath, "classify this request")
  let captured: CapturedInit
  globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
    captured = init as CapturedInit
    // Abort before response parsing — we only need to observe the request init.
    throw new Error("__captured__")
  }) as unknown as typeof globalThis.fetch
  try {
    // No fetchFn injected → the agent must fall through to proxyAwareFetch.
    await runOpenRouterAgent(
      promptPath,
      { token_budget: 100, timeout_s: 5 } as unknown as SubagentManifest,
    ).catch(() => {})
    expect(captured?.dispatcher).toBeInstanceOf(ProxyAgent)
  } finally {
    globalThis.fetch = origFetch
    restoreEnv("OPENROUTER_API_KEY", prevKey)
    restoreEnv("HTTPS_PROXY", prevProxy)
    rmSync(dir, { recursive: true, force: true })
  }
})

test("canary health_url defaults to proxyAwareFetch (dispatcher attached under HTTPS_PROXY)", async () => {
  const origFetch = globalThis.fetch
  const prevProxy = setEnv("HTTPS_PROXY", "http://127.0.0.1:19991")
  let captured: CapturedInit
  globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
    captured = init as CapturedInit
    return new Response("ok", { status: 200 }) // 2xx → phase passes, no retry/sleep
  }) as unknown as typeof globalThis.fetch
  try {
    // No httpFetch injected → defaultHttpFetch must route through proxyAwareFetch.
    // Public host (not loopback / NO_PROXY) so the proxy dispatcher is attached.
    await runCanaryChecks({
      packageName: "@sdsrs/sgc",
      expectedVersion: "1.0.0",
      phases: ["health_url"],
      healthUrl: "https://example.com/health",
    })
    expect(captured?.dispatcher).toBeInstanceOf(ProxyAgent)
  } finally {
    globalThis.fetch = origFetch
    restoreEnv("HTTPS_PROXY", prevProxy)
  }
})
