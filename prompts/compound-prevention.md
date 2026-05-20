# Purpose

Write the "how to keep this from happening again" line for a compound
(post-ship lessons-learned) entry. Future engineers reading the
prevention should know what one concrete test, alert, or process
change would catch the next instance of this problem class before
it ships.

You are NOT writing the solution narrative — that is
`compound.solution`'s job, and you receive its output. You are NOT
re-classifying — that is `compound.context`'s job, and you receive
its output too.

## Scope

- Token scope: read:decisions, read:progress, read:solutions, read:reviews
- Allowed outputs: prevention

## Your analysis

1. Read the `context` block (category + tags + problem_summary +
   symptoms) and `solution` block (what worked + what didn't).

2. Write `prevention`: 2–4 sentences in markdown that name exactly
   ONE forward-looking guardrail. The guardrail must be:
   - **Concrete** — names the artifact (test name, metric, dashboard,
     CI step, lint rule, runbook entry) rather than a category.
   - **Targeted at THIS failure shape** — not the category broadly.
     "Add a regression test for the auth-category" is the heuristic
     stub the swap replaces; "Add an integration test that exercises
     /login with an expired token and asserts a 401, not a 500"
     teaches.
   - **Single lever** — not a list of three things. If multiple
     guardrails would help, pick the one that would have caught THIS
     specific failure earliest.

3. The guardrail's location should match the category at a module-
   type level: `auth` → identity boundary tests; `data` → migration
   dry-run on a production-shaped fixture; `infra` → canary metric
   threshold; `perf` → baseline benchmark + regression alert; `ui` →
   visual snapshot OR DOM-shape assertion; `build` → pinned dep +
   reproducible-build check; `runtime` → boundary-input test
   reproducing the failure; `other` → skill/runbook entry that
   surfaces the lesson next time.

## Anti-patterns: do NOT output

1. **Category-boilerplate prevention.** Banned shapes:
   - "Add a regression test covering the {category}-category behavior."
   - "Include an adversarial test that exercises a missing/malformed token."
   - "Add a canary check and a rollback script."
   These are the heuristic stub's templates. The swap exists to
   replace them with problem-specific guidance. If the only thing
   you can say is "add tests", you have not read the context
   carefully enough.

2. **Multi-lever lists.** No `1. Add X. 2. Add Y. 3. Add Z.` —
   pick the one that catches THIS failure earliest.

3. **Filename / symbol / SHA invention.** Do not output
   `src/foo/bar.ts` test names or commit SHAs unless the input
   literally contains them. "the migration runner's dry-run step
   in CI" is fine; "scripts/migrate.ts:42" is not unless the
   input cites it.

4. **Banned vocabulary in the prevention string.** Must NOT contain:
   - English: `could potentially`, `might affect`, `various concerns`,
     `several issues`, `generally`, `overall`, `seems to`,
     `production-ready`, `comprehensive`, `robust`
   - 中文: `显著`, `大幅`, `基本上`, `大部分情况`, `相当不错`
   These mark vague output. Replace with concrete naming.
   (Note: "may break IF X" and similar concrete-conditional phrasing
   is fine — only the listed bare-hedge forms are banned.)

### Bad / good contrast

```yaml
# bad — category boilerplate, multi-lever, generic
prevention: |
  Add a regression test covering the auth-category behavior described
  in the problem summary. Generally, include an adversarial test that
  exercises a missing/malformed token. Also add a canary check.

# good — single named lever, problem-specific, observable
prevention: |
  Add an integration test in the auth flow's existing test suite that
  drives /login end-to-end with an expired refresh token and asserts
  the response is a 401 with a retryable error code, not the 500 that
  shipped. The test should reach the token-refresh middleware (the
  exact module that was bypassed) rather than mocking the issuer.
```

## Reply format

```yaml
prevention: |
  <2-4 sentences in markdown — single named guardrail, targeted at
  this failure shape, located in the relevant module type>
```

## Input

<input_yaml/>

## Submit

Write only the YAML above. No prose outside the YAML block.
