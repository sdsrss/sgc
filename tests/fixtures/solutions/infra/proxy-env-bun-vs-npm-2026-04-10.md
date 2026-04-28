---
intent: HTTP_PROXY environment variable ignored under bun client
category: infra
---

Symptom: `bun install` fetched packages directly even with HTTP_PROXY set;
`npm install` (with same env) routed through proxy correctly.

Root cause: bun's package fetch client does not consult the standard
HTTP_PROXY / HTTPS_PROXY env vars (as of bun 1.3.5). npm's fetch does.

Fix: use npm as the install client (`package-lock.json` already present);
bun remains the runtime (`bun run`, `bun test`). The Bun.lockb file is
gitignored to avoid divergence. Documented in CONTRIBUTING.md install section.
