// C11 (audit v1.37.0): Node's global fetch ignores HTTP(S)_PROXY, so in a
// proxied network every outbound LLM / health-check call hangs. proxy-fetch
// routes fetch through undici's ProxyAgent when a proxy env var is set, and is
// a no-op passthrough otherwise. These tests inject a fake base fetch to capture
// the init object — no real network / proxy is contacted.

import { test, expect } from "bun:test"
import { ProxyAgent } from "undici"
import { makeProxyAwareFetch } from "../../src/dispatcher/proxy-fetch"

type FakeInit = (RequestInit & { dispatcher?: unknown }) | undefined

function spyFetch(): { fetch: typeof globalThis.fetch; last: () => FakeInit } {
  let captured: FakeInit
  let called = false
  const fetch = (async (_url: unknown, init?: RequestInit) => {
    captured = init as FakeInit
    called = true
    return new Response("ok")
  }) as unknown as typeof globalThis.fetch
  return { fetch, last: () => (called ? captured : ("uncalled" as unknown as FakeInit)) }
}

test("HTTPS_PROXY set → fetch dispatched through a ProxyAgent", async () => {
  const base = spyFetch()
  const pf = makeProxyAwareFetch(base.fetch, { HTTPS_PROXY: "http://127.0.0.1:19999" } as NodeJS.ProcessEnv)
  await pf("https://example.com")
  expect(base.last()?.dispatcher).toBeInstanceOf(ProxyAgent)
})

test("HTTP_PROXY honored when HTTPS_PROXY absent", async () => {
  const base = spyFetch()
  const pf = makeProxyAwareFetch(base.fetch, { HTTP_PROXY: "http://127.0.0.1:19998" } as NodeJS.ProcessEnv)
  await pf("http://example.com")
  expect(base.last()?.dispatcher).toBeInstanceOf(ProxyAgent)
})

test("no proxy env → base fetch called with init untouched (no dispatcher)", async () => {
  const base = spyFetch()
  const pf = makeProxyAwareFetch(base.fetch, {} as NodeJS.ProcessEnv)
  await pf("https://example.com")
  // init was undefined at the call site and must stay undefined — the no-proxy
  // path is byte-for-byte the prior globalThis.fetch behavior.
  expect(base.last()).toBeUndefined()
})

test("lowercase https_proxy is honored", async () => {
  const base = spyFetch()
  const pf = makeProxyAwareFetch(base.fetch, { https_proxy: "http://127.0.0.1:19997" } as NodeJS.ProcessEnv)
  await pf("https://example.com")
  expect(base.last()?.dispatcher).toBeInstanceOf(ProxyAgent)
})
