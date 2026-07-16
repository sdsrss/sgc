// Proxy-aware fetch (C11, audit v1.37.0).
//
// Node's global fetch (undici under the hood) does NOT read the HTTP(S)_PROXY
// environment variables. The rest of the toolchain (git, curl, npm) honors
// them, so on a proxied network sgc's outbound calls — OpenRouter LLM requests
// (openrouter-agent.ts) and canary health-check probes (canary.ts) — were the
// odd ones out: they'd bypass the proxy and hang until their timeout.
//
// undici's ProxyAgent, wired in as the fetch `dispatcher`, restores that proxy.
// The dispatcher is built ONLY when a proxy env var is present, so the default
// (no-proxy) path is byte-for-byte the prior globalThis.fetch behavior — nothing
// changes for the common case. Callers reach this via the same `fetchFn` /
// `httpFetch` injection seams they already had, so the test surface is unchanged.

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

// A ProxyAgent owns a connection pool; rebuilding it per request would defeat
// keep-alive. Cache by proxy URL so a changed env (mostly in tests) rebuilds.
let cached: { url: string; agent: ProxyAgent } | undefined

function dispatcherForEnv(env: NodeJS.ProcessEnv): ProxyAgent | undefined {
  const url = proxyUrlFromEnv(env)
  if (!url) return undefined
  if (cached?.url !== url) cached = { url, agent: new ProxyAgent(url) }
  return cached.agent
}

/**
 * Build a drop-in replacement for globalThis.fetch that routes through
 * HTTP(S)_PROXY when set. No proxy env → delegates to `baseFetch` with the init
 * untouched (zero behavior change). `baseFetch` and `env` are injectable so the
 * env-gating and dispatcher wiring can be unit-tested without a real proxy.
 */
export function makeProxyAwareFetch(
  baseFetch: typeof globalThis.fetch = globalThis.fetch,
  env: NodeJS.ProcessEnv = process.env,
): typeof globalThis.fetch {
  return ((input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit) => {
    const dispatcher = dispatcherForEnv(env)
    if (!dispatcher) return baseFetch(input, init)
    // Node's global fetch accepts `dispatcher` on init (an undici extension the
    // DOM RequestInit type does not model), hence the cast.
    return baseFetch(input, { ...init, dispatcher } as RequestInit)
  }) as typeof globalThis.fetch
}

/**
 * Process-wide proxy-aware fetch. Reads process.env at call time, so it picks
 * up the proxy config the process was launched with. This is the default used
 * by the OpenRouter agent and the canary health-check when the caller injects
 * no explicit fetch.
 */
export const proxyAwareFetch: typeof globalThis.fetch = makeProxyAwareFetch()
