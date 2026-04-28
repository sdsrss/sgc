---
intent: rotating long-lived API keys without dropping in-flight requests
category: auth
---

Rotation strategy: dual-key window. Both old and new keys accepted by the
verifier for a 5-minute overlap. After overlap, old key invalidated.

Bug: in-flight requests started before rotation but landing after old-key
invalidation got 401. Mitigation: include rotation_id header on every
request; verifier picks the right key from rotation_id timestamp.

Tests covered: clock skew up to ±60s; concurrent rotation while requests
land; rotation rollback (re-activate old key) within the overlap window.
