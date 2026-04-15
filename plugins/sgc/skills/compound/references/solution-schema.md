# Solution Entry Schema

Every solution entry in `.sgc/solutions/{category}/{slug}.md` follows this format:

## Frontmatter (YAML)

```yaml
---
id: <ULID>
signature: <SHA256 of normalized problem + error fingerprint>
category: runtime|build|auth|data|perf|ui|infra|other
tags:
  - <tag1>
  - <tag2>
first_seen: <ISO8601>
last_updated: <ISO8601>
times_referenced: 0
source_task_ids:
  - <task_id that generated this entry>
confidence: provisional|confirmed|canonical
---
```

## Body (Markdown)

```markdown
# <Problem Title>

## Problem
<What went wrong, in 1-3 sentences>

## Symptoms
- <Observable symptom 1>
- <Observable symptom 2>

## What Didn't Work
- **Approach**: <what was tried>
  **Why it failed**: <reason>

## Root Cause
<The actual underlying cause>

## Solution
<The fix that worked, with code if applicable>

## Prevention
<How to prevent this class of problem in the future>

## Related Components
- <file or module affected>
```

## Dedup Rules

- Before writing ANY new entry, `compound.related` must check existing solutions/
- Similarity threshold: 0.85 (not tunable)
- On match: update existing entry (append task_id, refresh timestamp, merge new what_didnt_work)
- Do NOT overwrite existing solution/prevention fields on update

## Categories

| Category | Examples |
|----------|----------|
| runtime | Edge runtime compat, SSR hydration, memory leaks |
| build | Webpack/Vite config, dependency conflicts, bundling |
| auth | JWT, session, OAuth, permissions, RBAC |
| data | DB queries, migrations, data integrity, caching |
| perf | N+1, slow queries, bundle size, Core Web Vitals |
| ui | CSS, responsive, accessibility, theme, animation |
| infra | Deploy, CI/CD, Docker, DNS, SSL |
| other | Anything that doesn't fit above |
