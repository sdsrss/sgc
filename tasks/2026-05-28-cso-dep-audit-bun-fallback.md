---
slug: 2026-05-28-cso-dep-audit-bun-fallback
status: closed
closed_in: v1.17.3 (2026-05-28)
surfaced_by: GS-5 v1.17.0 self-dogfood (`sgc cso` 2026-05-28T04:45Z)
priority: low
level: L1
---

## Resolution (v1.17.3)

**Root cause**: not output drift / not stderr leakage / not workspace
confusion. `bun audit --json` (v1.3.5) emits clean valid JSON on stdout
(stderr separation verified) — but the **schema** differs from npm:

```json
// bun shape (package-keyed advisory map)
{ "@anthropic-ai/sdk": [{ "id": 1119428, "severity": "moderate", ... }] }

// npm shape (counts under metadata)
{ "metadata": { "vulnerabilities": { "moderate": 1, "total": 1, ... } } }
```

`cso.ts:parseNpmAudit` reads `j.metadata?.vulnerabilities` → undefined on
the bun shape → returns null → triggers the "non-JSON or unparseable"
warning (a false claim — the JSON parses cleanly). The npm fallback
never runs because bun returned a non-null result (just with content the
parser doesn't understand).

**Fix**: added `parseBunAudit(stdout)` that handles the package-keyed
shape, plus a schema-aware `parseAuditByTool(tool, stdout)` dispatcher
that tries the tool-specific parser first and falls back to the other
parser if it returns null (robust to future bun/npm schema drift).
`auditDependencies` now calls the dispatcher.

**Verify command (Iron Law #2)**:
```
$ bun src/sgc.ts cso
dependency-audit: warn (0 finding(s), 1 warning(s))
  - 1 moderate vulnerability(ies) via bun
```
Pre-fix: `dep audit skipped` warning (parser failure misreported). Post-
fix: accurate report of 1 moderate vulnerability (the @anthropic-ai/sdk
GHSA-p7fg-763f-g4gf advisory, version range >=0.79.0 <0.91.1; sgc's
^0.89.0 is in range). The vulnerability itself is a separate ticket
(bump `@anthropic-ai/sdk` to ^0.91.1) — this ticket closes the *parser*
bug, not the underlying dep.

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
