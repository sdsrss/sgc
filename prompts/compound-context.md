# Purpose

Build the context block for a compound (post-ship lessons-learned) entry:
classify the problem, tag it, summarize the essence, and list observable
symptoms.

You are NOT writing the solution narrative — that is `compound.solution`'s
job. You are NOT deduping — that is `compound.related`'s job. Your job
is the FACTUAL frame: what kind of problem is this, what does it look
like, what would another engineer search for to find it again.

## Scope

- Token scope: read:decisions, read:progress, read:solutions, read:reviews
- Allowed outputs: category, tags, problem_summary, symptoms

## Your analysis

1. Read the `intent` (a `title\n\nmotivation` markdown block, sometimes
   plus `diff` and `ship_outcome`). Reason from those texts alone. Do
   NOT invent file paths, function names, or commit SHAs that are not
   literally present in the input.

2. Pick exactly ONE `category` from the closed enum:
   `auth | data | infra | perf | ui | build | runtime | other`.
   Definitions:
   - `auth` — authentication, authorization, sessions, tokens, identity
   - `data` — schema, migrations, SQL, persistence, data integrity
   - `infra` — deploy, k8s, docker, terraform, CI/CD, host config
   - `perf` — latency, throughput, cache hit rate, timeout tuning
   - `ui` — rendering, layout, components, frontend interaction
   - `build` — bundlers, dependency resolution, compile pipeline
   - `runtime` — crashes, null/undefined, races, exception flow
   - `other` — anything that doesn't cleanly fit above

   When unsure between two categories, return `other`. Do NOT force-fit.
   "authorize the user to read docs" is `other` (or `auth` only if the
   problem is actually about token/session machinery, not the verb
   "authorize").

3. Emit `tags`: lowercase, hyphen/underscore-separated, ≤ 8 items
   total, each ≤ 20 characters. Tags must be searchable terms — what
   another engineer would type into grep, not sentence fragments.
   Examples: `rate-limit`, `migration`, `nfc`, `spawn-timeout`. NOT:
   `the auth system`, `slow queries sometimes`.

4. Emit `problem_summary`: 2–4 sentences distilling the PROBLEM
   (not the solution, not a recap of the intent title). Future search
   reads this first; vague summaries waste retrieval budget.

5. Emit `symptoms`: 1–4 observable, specific symptoms drawn from
   `intent` / `diff` / `ship_outcome`. If the input does not name a
   concrete symptom, return `["(symptom not stated in input)"]` —
   honesty over fabrication.

## Anti-patterns: do NOT output

1. **Filename / symbol invention.** Do not output `src/foo/bar.ts`,
   function names, line numbers, or commit SHAs unless the input
   literally contains them. compound is post-ship archival, not code
   navigation.

2. **Forced category fit.** When intent does not match any of the 7
   specific buckets, return `other`. Squeezing `authorize the user to
   read docs` into `auth` because the word "authorize" appears is the
   exact failure mode of the heuristic this swap replaces.

3. **Sentence-shaped tags.** `tags` is a search-term list, not a
   description. Bad: `["the auth flow", "various concerns"]`. Good:
   `["auth", "session-token"]`.

4. **`problem_summary` that recaps intent.** The summary is a fresh
   distillation of the PROBLEM. Do not paraphrase the intent title;
   do not list "the user wants to add X." State the failure shape or
   risk shape that motivated the work.

5. **Placeholder `symptoms`.** Banned: `"behavior documented in
   intent"`, `"see the diff"`, `"the change shipped"`. If no concrete
   symptom is in the input, output the literal string
   `"(symptom not stated in input)"`.

6. **Banned vocabulary in any output string.** `category` enum is
   already constrained; `tags`, `problem_summary`, `symptoms` must NOT
   contain:
   - English: `could potentially`, `might affect`, `various concerns`,
     `several issues`, `generally`, `overall`, `seems to`,
     `production-ready`, `comprehensive`, `robust`
   - 中文: `显著`, `大幅`, `基本上`, `大部分情况`, `相当不错`
   These mark vague output. Replace with concrete naming.

### Bad / good contrast

```yaml
# bad — forced category, lazy tags, intent-recap summary, placeholder symptoms
category: auth
tags:
  - the auth system
  - various concerns
problem_summary: |
  The user wants to authorize readers to access the documentation pages.
  This was implemented and shipped.
symptoms:
  - behavior documented in intent

# good — honest "other", searchable tags, problem-shape summary, concrete symptom
category: other
tags:
  - docs-access
  - permissions
  - reader-role
problem_summary: |
  Documentation pages were globally readable but a subset (internal-only
  RFCs) needed reader-role gating without breaking the public docs path.
  The gate had to be additive — existing public URLs must keep returning
  200 for unauthenticated viewers.
symptoms:
  - "(symptom not stated in input)"
```

## Reply format

```yaml
category: auth | data | infra | perf | ui | build | runtime | other
tags:
  - <tag-1>
  # ≤ 8 items, each ≤ 20 chars, lowercase, hyphen/underscore
problem_summary: |
  <2-4 sentences, problem essence not intent recap>
symptoms:
  - <observable symptom 1>
  # 1-4 items; if none stated, single-element ["(symptom not stated in input)"]
```

## Input

<input_yaml/>

## Submit

Write only the YAML above. No prose outside the YAML block.
