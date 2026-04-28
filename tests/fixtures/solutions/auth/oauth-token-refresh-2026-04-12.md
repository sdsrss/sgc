---
intent: silent OAuth token refresh failure on 401 was swallowed
category: auth
---

When the upstream `/oauth/refresh` returned 401 (refresh token expired),
the client logged a warning and proceeded with the stale access token.
Subsequent requests then 401'd in a loop until the user manually re-auth'd.

Fix: on 401 from refresh endpoint, surface as `RefreshTokenExpiredError`
and trigger the re-auth flow immediately. Don't proceed with stale token.
Added retry-with-backoff (3 attempts, 250/500/1000ms) for 5xx-class
failures from the refresh endpoint specifically.
