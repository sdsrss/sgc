---
name: qa
description: "Use for the L2+ browser-QA gate. Real-browser mode (Playwright Chromium) is opt-in (--browse / SGC_QA_REAL=1); by default runs a stub returning concern (never rubber-stamps). Writes verdict + findings to reviews/{task}/qa/."
---

# QA

Spawn `qa.browser` to run the QA gate; with the real-browser opt-in (`--browse` / `SGC_QA_REAL=1`) it drives a Playwright Chromium and writes verdict + screenshot refs to `reviews/{task_id}/qa/qa.browser.md`, flipping `hasQaEvidence` true to unblock the L2+ ship gate.

> **Real-browser mode is opt-in (Playwright).** By default `qa.browser` runs a stub that returns `concern` (never `pass`), so the gate is never silently rubber-stamped. Enable it with `--browse` or `SGC_QA_REAL=1` — it launches a Playwright Chromium (`goto` → console/page errors → screenshot → verdict). Needs a browser: `npx playwright install chromium`, or `SGC_QA_BROWSER=chrome` for system Chrome.

**Core principle:** "looks correct" is not evidence — with `--browse` / `SGC_QA_REAL=1`, open the browser (Playwright), run the flow, capture the proof; by default `qa.browser` returns `concern` rather than rubber-stamping.

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
- **Real-browser runner**: [`src/dispatcher/agents/playwright-runner.ts`](../../../../src/dispatcher/agents/playwright-runner.ts) — Playwright Chromium smoke (opt-in via `--browse` / `SGC_QA_REAL=1`)
- **Evidence helper**: `hasQaEvidence` in [`src/dispatcher/state.ts`](../../../../src/dispatcher/state.ts)
- **Invariants**: §1 qa no-solutions · §6 append-only (one qa review per task)

## Execution

When this skill is invoked, dispatch to the sgc CLI:

```bash
bun src/sgc.ts qa $ARGUMENTS
```

## Console classification (reference)

`qa.browser` fails the verdict on `pageerror` / `console.error` captured via Playwright (`page.on("pageerror")` / `page.on("console")`). Screenshot-capture misses are surfaced as a note but don't fail the verdict.

## Environmental note

If the chromium sandbox is broken (Ubuntu 23.10+ AppArmor user-namespace restriction, RHEL SELinux), the Playwright launch uses `chromiumSandbox: false`. Hermetic tests inject a fake `launch`/`browseRunner` instead of a real browser — see `tests/dispatcher/playwright-runner.test.ts`; the gated real-browser test is `tests/eval/qa-browse-real.test.ts`.

## Delegation hint

For rich interactive browser testing beyond sgc's headless qa.browser:
- `gs:/browse` — full headless browser with navigation, screenshots, and element interaction
