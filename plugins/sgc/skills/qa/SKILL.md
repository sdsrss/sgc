---
name: qa
description: "Use when real browser testing is needed - launches headless browser, executes user flows, captures screenshots, reports findings"
---

# QA

Spawn `qa.browser`, drive flows through the `browse` binary, write verdict + screenshot refs to `reviews/{task_id}/qa/qa.browser.md`. `hasQaEvidence` becomes true, unblocking the L2+ ship gate.

**Core principle:** "looks correct" is not evidence. Open the browser, run the flow, capture the proof.

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
