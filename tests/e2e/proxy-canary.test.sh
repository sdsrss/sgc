#!/usr/bin/env bash
# Proxy support, end to end, on the Node running this script.
#
# Runs the COMMITTED bundle under Node with HTTP_PROXY pointing at a fake CONNECT
# proxy, and has `sgc canary` fetch a health URL on a non-loopback hostname
# (loopback is always reached directly). Passes only if the canary goes green
# AND the proxy saw the request.
#
# Why under Node and not in bun test: the bug class this guards is Node-specific.
# sgc hands an npm-undici ProxyAgent to a fetch; Node's built-in fetch carries
# its own undici, and when the two disagree on the dispatcher handler API the
# request fails ("fetch failed", UND_ERR_INVALID_ARG). v1.38.5 broke this way on
# Node 26. bun's fetch is a different implementation and cannot reproduce it.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="$(mktemp -d)"
PROXY_PID=""
cleanup() {
  if [ -n "$PROXY_PID" ]; then kill "$PROXY_PID" 2>/dev/null || true; fi
  rm -rf "$WORK"
}
trap cleanup EXIT

node "$REPO/tests/e2e/fake-connect-proxy.cjs" "$WORK/proxy" &
PROXY_PID=$!
for _ in $(seq 1 50); do
  [ -s "$WORK/proxy.port" ] && break
  sleep 0.1
done
[ -s "$WORK/proxy.port" ] || { echo "FAIL: fake proxy did not start" >&2; exit 1; }
PORT="$(cat "$WORK/proxy.port")"

echo "--- node $(node --version), proxy 127.0.0.1:$PORT ---"
set +e
env -u HTTPS_PROXY -u https_proxy -u NO_PROXY -u no_proxy \
  HTTP_PROXY="http://127.0.0.1:$PORT" http_proxy="http://127.0.0.1:$PORT" \
  SGC_STATE_ROOT="$WORK/state" \
  node "$REPO/plugins/sgc/bin/sgc.mjs" canary \
    --package @sdsrs/sgc --version 0.0.0-proxy-e2e \
    --phases health_url \
    --health-url http://sgc-proxy-e2e.invalid/health \
    --health-regex sgc-proxy-e2e-ok
CODE=$?
set -e
CONNECTS="$(cat "$WORK/proxy.connects")"
echo "canary exit=$CODE, CONNECTs seen by the proxy=$CONNECTS"
[ "$CODE" -eq 0 ] || { echo "FAIL: canary health check through the proxy failed" >&2; exit 1; }
[ "$CONNECTS" -ge 1 ] || { echo "FAIL: request did not go through the proxy" >&2; exit 1; }
echo "PROXY-CANARY OK"
