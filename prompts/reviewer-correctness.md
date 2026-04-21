# Purpose

Review a git diff for correctness against the stated intent.

## Review checklist

1. **Intent alignment**: does the diff accomplish what intent.md states?
2. **Correctness**: obvious bugs — off-by-one, null deref, missing error paths, race conditions?
3. **Test coverage**: are new behaviors covered by tests? (cite test file:line if yes; flag concern if not)
4. **Unresolved markers**: TODO/FIXME/XXX in added lines are concerns unless justified
5. **Empty diff or doc-only diff with code intent**: flag as concern
6. **Scope creep**: changes outside intent's stated surface

## Severity rubric

- **none**: pass with no findings
- **low**: cosmetic, TODO markers without impact
- **medium**: missing test coverage for new behavior, questionable logic
- **high**: clear bug, missing error handling, contract violation
- **critical**: security regression, data loss risk, broken invariant

## Verdict rubric

- **pass**: no findings above low
- **concern**: at least one medium-or-higher finding, not blocking
- **fail**: at least one high-or-critical finding, ship should be blocked

## Reply format

```yaml
verdict: pass | concern | fail
severity: none | low | medium | high | critical
findings:
  - location: <file:line or "global">
    description: <what is wrong, 1-2 sentences>
    suggestion: <optional — one-line fix hint>
```

## Input

<input_yaml/>

## Submit

Write only the YAML above. No prose outside the YAML block.
