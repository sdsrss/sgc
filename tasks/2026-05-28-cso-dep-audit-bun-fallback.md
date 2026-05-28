---
slug: 2026-05-28-cso-dep-audit-bun-fallback
status: open
surfaced_by: GS-5 v1.17.0 self-dogfood (`sgc cso` 2026-05-28T04:45Z)
priority: low
level: L1
---

# Follow-up: cso dep-audit warns "bun audit returned non-JSON" on sgc repo

## Surfaced by

First `sgc cso` self-dogfood on sgc repo returned:

```
dependency-audit: warn (0 finding(s), 1 warning(s))
  - bun audit returned non-JSON or unparseable output; dep audit skipped
```

## Hypotheses to investigate

1. **bun version mismatch** — `bun audit --json` may not exist or may
   output differently in the installed bun version. Confirm:
   ```sh
   bun --version
   bun audit --json 2>&1 | head -20
   ```
2. **Output format drift** — bun audit may emit JSON to stderr instead
   of stdout, OR output JSON Lines (NDJSON) rather than a single
   object. Check `cso.ts:tryAudit` stdout/stderr handling.
3. **Workspace / monorepo confusion** — sgc has `plugins/sgc/`
   subdirectory with its own `package.json`. `bun audit` from root may
   walk both and produce mixed output the parser can't handle.

## Expected behavior

`auditDependencies()` should either:
- Successfully parse bun audit output → return `pass` (or `warn`/`fail` per
  vulnerability counts), OR
- Fail gracefully → fall through to `npm audit --json` (already
  implemented), OR
- If both tools unavailable / unparseable → `warn` with clear
  diagnostic in the warning string

Current behavior is the third path — works correctly but the warning
suggests bun audit IS available but unparseable, which deserves
investigation.

## Verify command (Iron Law #2)

```sh
bun src/sgc.ts cso
```

Post-fix: `dependency-audit` check should return `pass` with no
warnings on a clean sgc repo (no known vulnerabilities at audit time).

## Out of scope

- DOG-5 test-file false positives (fixed in v1.17.1).
- events-anomaly historical unpaired spawns
  ([[2026-05-28-cso-events-anomaly-spawn-end-missing.md]]).
