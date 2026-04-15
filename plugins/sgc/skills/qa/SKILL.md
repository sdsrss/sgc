---
name: qa
description: "Use when real browser testing is needed - launches headless browser, executes user flows, captures screenshots, reports findings"
---

# QA

Launch a headless browser, execute user flows, capture screenshots, and report findings. Real browser testing, not theoretical verification.

**Core principle:** "Looks correct" is not evidence. Open the browser, run the flow, capture the proof.

## When to Use

- User runs `/qa <target>` where target is a URL, route, or feature name
- Testing UI changes after `/work`
- Verifying frontend behavior that unit tests cannot cover
- Before `/ship` when the task involves user-facing changes

## Permission

| Directory | Access |
|-----------|--------|
| decisions | R |
| progress | R |
| solutions | **FORBIDDEN** |
| reviews | W |

**CRITICAL**: This skill MUST NOT read `solutions/`. Invariant #1 — Generator-Evaluator Separation applies to QA as well as code review.

## Process

### Step 1: Identify Test Target

Parse the target from the user's command:

- URL: `http://localhost:3000/dashboard` → navigate directly
- Route: `/dashboard` → construct from known dev server URL
- Feature: `login flow` → determine the entry point from `progress/feature-list.md`

If the dev server is not running, attempt to start it. If it cannot be started, report `[BLOCKED]` with the reason.

### Step 2: Plan User Flows

Based on the target and the feature list, plan concrete user flows to test:

```markdown
## QA Plan
1. Navigate to [URL]
2. Verify [element] is visible
3. Click [button/link]
4. Fill [form field] with [test data]
5. Submit and verify [expected result]
6. Check console for errors
```

Each flow should test one user journey. Plan 2-5 flows depending on complexity.

### Step 3: Execute Flows

Use the browse module to execute each flow:

1. **Navigate** to the target URL.
2. **Wait** for the page to fully load (no pending network requests, DOM stable).
3. **Screenshot** the initial state.
4. **Execute** each step in the flow.
5. **Screenshot** after each significant state change.
6. **Capture** browser console output throughout.

### Step 4: Console Classification

Classify console messages:

| Classification | Criteria | Action |
|----------------|----------|--------|
| FATAL | `pageerror`, `unhandledrejection`, app-specific error patterns | Fail the QA |
| WARN | Third-party library warnings, unknown sources | Note in report |
| INFO | Debug logs, framework messages | Ignore |
| UNKNOWN | Cannot classify → default WARN | Note in report, escalate if on critical path |

### Step 5: Bug Classification

For each issue found:

| Severity | Description | Example |
|----------|-------------|---------|
| Critical | Feature broken, data loss, security issue | Login form submits empty, XSS in input |
| High | Feature works incorrectly, major UX issue | Wrong data displayed, layout completely broken |
| Medium | Minor UX issue, cosmetic problem | Misaligned element, wrong color, slow transition |
| Low | Nitpick, suggestion | Slightly off padding, could use better label |

### Step 6: Write Report

Save to `reviews/{task_id}/qa/report.md`:

```markdown
# QA Report
Task: {task_id}
Target: {url}
Verdict: PASS | FAIL
Date: {timestamp}

## Flows Tested
### Flow 1: [Name]
- Steps: [executed steps]
- Result: PASS | FAIL
- Screenshots: [references]
- Console: [FATAL/WARN count]

### Flow 2: [Name]
...

## Bugs Found
### [BUG-001] [Title]
- Severity: critical | high | medium | low
- Flow: [which flow]
- Step: [which step]
- Expected: [what should happen]
- Actual: [what happened]
- Screenshot: [reference]
- Console: [relevant errors]

## Console Summary
- FATAL: {n}
- WARN: {n}
- Clean: yes | no

## Overall Assessment
[One paragraph summary]
```

### Step 7: Fix-and-Retest Loop (Optional)

If bugs are found and the user requests fixes:

1. Fix the identified bug.
2. Re-run ONLY the failing flow.
3. Screenshot the fixed state.
4. Update the QA report with the retest result.
5. Repeat until the flow passes or the user decides to defer.

Do not enter an infinite fix loop. If the same bug persists after 2 fix attempts, report `[BLOCKED]` and suggest a different approach.

### Step 8: Route

- **All flows pass, no FATAL console**: "QA passed. Run `/ship` when ready."
- **Bugs found**: "QA found {n} issues ({critical} critical, {high} high). Fix and re-run `/qa`, or proceed with known issues."

## Important Rules

- **Real browser only.** Do not simulate browser behavior. Launch the actual browser and interact with it.
- **Screenshot everything.** Every significant state change gets a screenshot. Screenshots are evidence.
- **No solutions/ access.** QA judges the running application independently. Past solutions create confirmation bias.
- **Console is evidence.** FATAL console errors fail the QA regardless of visual correctness.
- **Do not skip flows.** If the plan has 4 flows, run all 4. Do not stop after the first pass or first failure.
- **Respect the 2-attempt fix limit.** If a fix does not work twice, escalate, do not loop.
