---
intent: protect dispatcher from runaway LLM API spend via per-minute throttle
category: runtime
---

Implementation: leaky-bucket with 60-token capacity, refill 10/sec.
Each spawn() call deducts 1 token before issuing the LLM call. Bucket
empty → caller blocks up to 30s for refill, then fails fast with
ThrottleExceeded.

Per-agent override: planner.eng / planner.ceo bypass the bucket (they're
in the user's interactive critical path; throttling them creates user-
visible latency). Compound chain agents are subject to throttle.

Metrics emitted via events.ndjson: throttle.refill / throttle.deduct /
throttle.exhausted. Operator can `sgc tail --event-type throttle.*` to
diagnose.
