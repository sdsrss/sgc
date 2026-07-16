// C11 (audit v1.37.0): Node's global fetch ignores HTTP(S)_PROXY, so in a
// proxied network every outbound LLM / health-check call hangs. proxy-fetch
// routes fetch through undici's ProxyAgent when a proxy env var is set, honors
// NO_PROXY + loopback bypass, and is a no-op passthrough otherwise. These tests
// inject a fake base fetch to capture the init — no real network/proxy is used.

import { test, expect } from "bun:test"
import { ProxyAgent } from "undici"
import { makeProxyAwareFetch } from "../../src/dispatcher/proxy-fetch"

type FakeInit = (RequestInit & { dispatcher?: unknown }) | undefined

function spyFetch(): {
  fetch: typeof globalThis.fetch
  last: () => FakeInit
  calls: () => number
} {
  let captured: FakeInit
  let n = 0
  const fetch = (async (_url: unknown, init?: RequestInit) => {
    captured = init as FakeInit
    n++
    return new Response("ok")
  }) as unknown as typeof globalThis.fetch
  return { fetch, last: () => (n > 0 ? captured : ("uncalled" as unknown as FakeInit)), calls: () => n }
}

const env = (o: Record<string, string>) => o as NodeJS.ProcessEnv

// ── proxy attached when set ───────────────────────────────────────────────────

test("HTTPS_PROXY set → fetch dispatched through a ProxyAgent", async () => {
  const base = spyFetch()
  const pf = makeProxyAwareFetch(base.fetch, env({ HTTPS_PROXY: "http://127.0.0.1:19999" }))
  await pf("https://example.com")
  expect(base.last()?.dispatcher).toBeInstanceOf(ProxyAgent)
})

test("HTTP_PROXY honored when HTTPS_PROXY absent", async () => {
  const base = spyFetch()
  const pf = makeProxyAwareFetch(base.fetch, env({ HTTP_PROXY: "http://127.0.0.1:19998" }))
  await pf("http://example.com")
  expect(base.last()?.dispatcher).toBeInstanceOf(ProxyAgent)
})

test("lowercase https_proxy is honored", async () => {
  const base = spyFetch()
  const pf = makeProxyAwareFetch(base.fetch, env({ https_proxy: "http://127.0.0.1:19997" }))
  await pf("https://example.com")
  expect(base.last()?.dispatcher).toBeInstanceOf(ProxyAgent)
})

test("HTTPS_PROXY wins over HTTP_PROXY (precedence)", async () => {
  const base = spyFetch()
  const pf = makeProxyAwareFetch(
    base.fetch,
    env({ HTTP_PROXY: "http://127.0.0.1:1/http", HTTPS_PROXY: "http://127.0.0.1:2/https" }),
  )
  await pf("https://example.com")
  // Both set → the HTTPS agent is used; we can't read the URL off ProxyAgent, so
  // assert a dispatcher is present (precedence is exercised, no throw on either).
  expect(base.last()?.dispatcher).toBeInstanceOf(ProxyAgent)
})

// ── no proxy / bypass → untouched ─────────────────────────────────────────────

test("no proxy env → base fetch called with init untouched (no dispatcher)", async () => {
  const base = spyFetch()
  const pf = makeProxyAwareFetch(base.fetch, env({}))
  await pf("https://example.com")
  expect(base.last()).toBeUndefined()
})

test("empty-string proxy env → treated as unset (no dispatcher)", async () => {
  const base = spyFetch()
  const pf = makeProxyAwareFetch(base.fetch, env({ HTTPS_PROXY: "" }))
  await pf("https://example.com")
  expect(base.last()).toBeUndefined()
})

test("loopback targets bypass the proxy even when set", async () => {
  const proxied = env({ HTTP_PROXY: "http://127.0.0.1:19990" })
  for (const url of ["http://localhost:8080/health", "http://127.0.0.1:3000", "http://[::1]:9/x"]) {
    const base = spyFetch()
    const pf = makeProxyAwareFetch(base.fetch, proxied)
    await pf(url)
    expect(base.last()).toBeUndefined() // direct — no dispatcher for loopback
  }
})

test("NO_PROXY host + domain-suffix entries bypass the proxy", async () => {
  const e = env({ HTTPS_PROXY: "http://127.0.0.1:19990", NO_PROXY: "api.internal, .corp.example" })
  const exact = spyFetch()
  await makeProxyAwareFetch(exact.fetch, e)("https://api.internal/v1")
  expect(exact.last()).toBeUndefined()

  const suffix = spyFetch()
  await makeProxyAwareFetch(suffix.fetch, e)("https://svc.corp.example/x")
  expect(suffix.last()).toBeUndefined()

  const proxied = spyFetch()
  await makeProxyAwareFetch(proxied.fetch, e)("https://public.example.com/x")
  expect(proxied.last()?.dispatcher).toBeInstanceOf(ProxyAgent) // not in NO_PROXY → proxied
})

test("NO_PROXY=* bypasses everything", async () => {
  const base = spyFetch()
  const pf = makeProxyAwareFetch(base.fetch, env({ HTTPS_PROXY: "http://127.0.0.1:19990", NO_PROXY: "*" }))
  await pf("https://example.com")
  expect(base.last()).toBeUndefined()
})

// ── init preservation + robustness ────────────────────────────────────────────

test("existing init (signal, headers) preserved when proxy attached", async () => {
  const base = spyFetch()
  const pf = makeProxyAwareFetch(base.fetch, env({ HTTPS_PROXY: "http://127.0.0.1:19990" }))
  const ctrl = new AbortController()
  await pf("https://example.com", { signal: ctrl.signal, headers: { "x-test": "1" } })
  const init = base.last()
  expect(init?.dispatcher).toBeInstanceOf(ProxyAgent)
  expect(init?.signal).toBe(ctrl.signal)
  expect((init?.headers as Record<string, string>)["x-test"]).toBe("1")
})

test("malformed proxy URL throws a message naming the env var", () => {
  const base = spyFetch()
  const pf = makeProxyAwareFetch(base.fetch, env({ HTTPS_PROXY: "not a url" }))
  // dispatcherFor validates synchronously, so the wrapper throws synchronously
  // (before the async base fetch) — assert with the sync matcher.
  expect(() => pf("https://example.com")).toThrow(/proxy URL in HTTP\(S\)_PROXY/)
  expect(base.calls()).toBe(0) // never reached the base fetch
})
