---
intent: dispatcher spawn() timeout did not retry, leaving ghost tasks
category: runtime
---

Old behavior: spawn() throws SpawnTimeout on >timeout_s elapsed; caller
caught and rethrew, no retry. Network blips during LLM API calls created
1-2% spurious failures.

Fix: added retry-with-backoff outer loop in spawn.ts. 3 attempts max;
each attempt gets full timeout_s budget. Backoff between attempts
follows 250ms / 500ms / 1000ms (no jitter — single-process workload).

Failure classification: SpawnTimeout retries; SpawnError (manifest /
scope-token violation) does NOT retry (deterministic; pointless to retry).
