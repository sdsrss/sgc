// Proxy-aware fetch (C11, audit v1.37.0).
//
// Node's global fetch (undici under the hood) does NOT read the HTTP(S)_PROXY
// environment variables. The rest of the toolchain (git, curl, npm) honors
// them, so on a proxied network sgc's outbound calls — OpenRouter LLM requests
// (openrouter-agent.ts) and canary health-check probes (canary.ts) — were the
// odd ones out: they'd bypass the proxy and hang until their timeout.
//
// undici's ProxyAgent, wired in as the fetch `dispatcher`, restores that proxy.
// The dispatcher is attached ONLY when a proxy env var is present AND the target
// is not exempt (NO_PROXY / loopback), so the default (no-proxy) path is
// byte-for-byte the prior globalThis.fetch behavior. Callers reach this via the
// same `fetchFn` / `httpFetch` injection seams they already had.

import { ProxyAgent } from "undici"

// Precedence: HTTPS_PROXY (upper/lower) then HTTP_PROXY (upper/lower). We route
// all fetch through a single proxy — matching how curl/git pick one — rather
// than switching per target scheme, which sgc has no need to distinguish.
function proxyUrlFromEnv(env: NodeJS.ProcessEnv): string | undefined {
  return (
    env["HTTPS_PROXY"] ||
    env["https_proxy"] ||
    env["HTTP_PROXY"] ||
    env["http_proxy"] ||
    undefined
  )
}

// NO_PROXY is the standard companion to HTTP(S)_PROXY (curl, git, npm all honor
// it): a comma-separated list of hosts/domains to reach directly. Entries may be
// bare hosts (`api.internal`), domain suffixes (`.example.com` / `*.example.com`),
// or `*` (bypass everything). A trailing `:port` is ignored (host-only match).
function noProxyEntries(env: NodeJS.ProcessEnv): string[] {
  const raw = env["NO_PROXY"] || env["no_proxy"] || ""
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

function hostOf(input: Parameters<typeof globalThis.fetch>[0]): string | undefined {
  try {
    if (typeof input === "string") return new URL(input).hostname.toLowerCase()
    if (input instanceof URL) return input.hostname.toLowerCase()
    if (input instanceof Request) return new URL(input.url).hostname.toLowerCase()
    return new URL(String(input)).hostname.toLowerCase()
  } catch {
    return undefined
  }
}

// Loopback is always bypassed: routing a request to the client's own machine
// through an external proxy is never correct (and is the `sgc canary
// --health-url http://localhost:…` footgun). curl/most setups treat localhost
// as implicitly no-proxy; we make that explicit rather than relying on the
// operator to list it in NO_PROXY.
function isLoopback(host: string): boolean {
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "::1" ||
    host === "[::1]" ||
    host === "0.0.0.0" ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
  )
}

function shouldBypass(host: string | undefined, noProxy: string[]): boolean {
  if (!host) return false // unparseable target — let the proxy path handle it
  if (isLoopback(host)) return true
  for (const raw of noProxy) {
    if (raw === "*") return true
    const entry = (raw.split(":")[0] ?? "").replace(/^\*?\./, "") // ".x"/"*.x" → "x"
    if (!entry) continue
    if (host === entry || host.endsWith("." + entry)) return true
  }
  return false
}

// A ProxyAgent owns a connection pool; rebuilding it per request would defeat
// keep-alive. Cache by proxy URL; on a URL change (mostly in tests) close the
// stale agent before replacing it so its pool isn't orphaned.
let cached: { url: string; agent: ProxyAgent } | undefined

function dispatcherFor(url: string): ProxyAgent {
  if (cached?.url === url) return cached.agent
  // undici's ProxyAgent does NOT validate the URL at construction — it fails
  // lazily at connect with a bare error. Validate here so a bad HTTP(S)_PROXY
  // value fails fast with a message naming the env var, not a naked throw
  // buried in the first request.
  try {
    // eslint-disable-next-line no-new
    new URL(url)
  } catch {
    throw new Error(
      `invalid proxy URL in HTTP(S)_PROXY (${JSON.stringify(url)}): not a valid URL`,
    )
  }
  if (cached) {
    try {
      cached.agent.close()
    } catch {
      // best-effort — a failed close must not break the request
    }
  }
  const agent = new ProxyAgent(url)
  cached = { url, agent }
  return agent
}

/**
 * Build a drop-in replacement for globalThis.fetch that routes through
 * HTTP(S)_PROXY when set. No proxy env, or a NO_PROXY/loopback target →
 * delegates to the base fetch with the init untouched (zero behavior change).
 * `baseFetch` and `env` are injectable so the env-gating and dispatcher wiring
 * can be unit-tested without a real proxy; when `baseFetch` is omitted the
 * global fetch is read at CALL time (so a test-stubbed globalThis.fetch, and
 * the seam callers that rely on it, are honored).
 */
export function makeProxyAwareFetch(
  baseFetch?: typeof globalThis.fetch,
  env: NodeJS.ProcessEnv = process.env,
): typeof globalThis.fetch {
  return ((input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit) => {
    const base = baseFetch ?? globalThis.fetch
    const url = proxyUrlFromEnv(env)
    if (!url) return base(input, init)
    if (shouldBypass(hostOf(input), noProxyEntries(env))) return base(input, init)
    const dispatcher = dispatcherFor(url)
    // Node's global fetch accepts `dispatcher` on init (an undici extension the
    // DOM RequestInit type does not model), hence the cast.
    return base(input, { ...init, dispatcher } as RequestInit)
  }) as typeof globalThis.fetch
}

/**
 * Process-wide proxy-aware fetch. Reads process.env (and globalThis.fetch) at
 * call time, so it picks up the proxy config the process was launched with. This
 * is the default used by the OpenRouter agent and the canary health-check when
 * the caller injects no explicit fetch.
 */
export const proxyAwareFetch: typeof globalThis.fetch = makeProxyAwareFetch()
