---
name: qa
description: "Use for the L2+ browser-QA gate. Real-browser mode (headless chromium) is deferred/opt-in; by default runs a stub returning concern (never rubber-stamps). Writes verdict + findings to reviews/{task}/qa/."
---

# QA

Spawn `qa.browser` to run the QA gate; when the real-browser runner is wired it drives flows through the `browse` binary and writes verdict + screenshot refs to `reviews/{task_id}/qa/qa.browser.md`, flipping `hasQaEvidence` true to unblock the L2+ ship gate.

> **Real-browser mode is deferred.** By default `qa.browser` runs a stub that returns `concern` (never `pass`), so the gate is never silently rubber-stamped. The vendored `browse` binary ships only in the plugin payload (not the npm package — see `docs/POSITIONING.md` "Vendored components"), but wiring `sgc qa` to drive it is not yet done: the `SGC_QA_REAL` / `--browse` opt-in named in the source is reserved (read by no code), and the real path is reachable today only via a programmatic injected `browseRunner`. For real-browser QA, use `gs:/browse`.

**Core principle:** "looks correct" is not evidence — when the real-browser runner is wired, open the browser, run the flow, capture the proof; until then `qa.browser` returns `concern` rather than rubber-stamping.

## When to Use

- User runs `/qa <target> --flows a,b,c`
- L2+ task approaching ship (qa evidence is a hard ship gate)
- UI / user-facing change after `/work`

## Permission

| Directory | Access |
|-----------|--------|
| decisions | R |
| progress | R |
| solutions | **FORBIDDEN** (§1) |
| reviews | W |

Plus `exec:browser` for the headless chromium launch.

## Routing

- **Behavior**: [`src/commands/qa.ts`](../../../../src/commands/qa.ts) (`runQa`)
- **Agent**: [`src/dispatcher/agents/qa-browser.ts`](../../../../src/dispatcher/agents/qa-browser.ts) — injectable `browseRunner` for hermetic tests
- **Production browser**: [`plugins/sgc/browse/`](../../browse/) Bun-compiled single binary (Playwright-driven)
- **Evidence helper**: `hasQaEvidence` in [`src/dispatcher/state.ts`](../../../../src/dispatcher/state.ts)
- **Invariants**: §1 qa no-solutions · §6 append-only (one qa review per task)

## Execution

When this skill is invoked, dispatch to the sgc CLI:

```bash
bun src/sgc.ts qa $ARGUMENTS
```

## Console classification (reference)

`qa.browser` should fail the verdict on `pageerror` / `unhandledrejection` / app-specific error patterns in the browser console. Warnings note but don't fail. Third-party noise is filtered upstream in the browse binary.

## Environmental note

If chromium sandbox is broken (Ubuntu 23.10+ AppArmor user-namespace restriction, RHEL SELinux), the binary still launches with `--no-sandbox` fallback. Tests that must stay hermetic use the injectable `browseRunner` rather than the binary — see `tests/eval/qa-browser.test.ts`.

## Delegation hint

For rich interactive browser testing beyond sgc's headless qa.browser:
- `gs:/browse` — full headless browser with navigation, screenshots, and element interaction
