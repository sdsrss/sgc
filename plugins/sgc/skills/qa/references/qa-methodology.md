# QA Methodology

## Browser Testing Protocol

1. **Start browse daemon** if not running
   ```bash
   browse start --headless
   ```

2. **Navigate to target**
   ```bash
   browse goto <url>
   ```

3. **Execute critical user flows**
   - Login/logout
   - Core feature paths
   - Form submissions
   - Navigation between pages

4. **Capture evidence**
   ```bash
   browse snapshot --full-page
   ```

5. **Check for errors**
   - Console errors (FATAL: page errors, unhandled rejections)
   - Network failures (4xx, 5xx responses)
   - Visual regression (compare screenshots)
   - Accessibility violations

## Bug Classification

| Severity | Description | Action |
|----------|-------------|--------|
| Critical | App crashes, data loss, security hole | Block ship |
| High | Feature broken, major UX issue | Block ship |
| Medium | Degraded experience, workaround exists | Flag in review |
| Low | Cosmetic, minor annoyance | Note for backlog |

## QA Report Format

```markdown
## QA Report — {target}

**Verdict**: pass / concern / fail
**Tested flows**: {count}
**Failed flows**: {count}

### Passed Flows
- [flow description] — screenshot: {path}

### Failed Flows
- [flow description]
  - Step: {step that failed}
  - Expected: {what should happen}
  - Observed: {what actually happened}
  - Screenshot: {path}

### Console Errors
- {error messages if any}
```

## Fix-and-Retest Loop

If QA finds bugs and the task owner wants to fix them:
1. Fix the bug in /work
2. Re-run the failing flows only
3. Update the QA report
4. Maximum 3 retest cycles before escalating
