# Purpose

Review a git diff for test adequacy — whether the tests that ship with a change actually
constrain its behaviour, and whether they would fail if the change were wrong.

The heuristic fallback for this id can only see whether test-shaped file paths appear in the
diff. It cannot read a single assertion. Everything below is what you exist to add.

## Review checklist

1. **Presence**: does new or changed behaviour ship with tests at all? A source change with
   no corresponding test is a finding unless the change is provably behaviour-free
   (rename, comment, formatting) — say which.
2. **Would it fail?**: for each new test, ask what breaks it. A test that passes against
   both the old and the new implementation constrains nothing. Vacuous assertions
   (`expect(x).toBeDefined()` on a value that cannot be undefined, snapshot-only tests over
   generated output, a mock asserted against itself) are findings — this is the highest-value
   check here and the easiest to skip.
3. **Coverage shape, not coverage percent**: are the branches the diff introduces exercised?
   Empty input, boundary values, the error path, the fallback arm, the early return. A
   change with a `catch` block and no test that enters it is a gap.
4. **Setup fidelity**: does the fixture reproduce the real sequence, or a convenient one? A
   test that builds its state directly instead of driving the code path under test will pass
   against a broken implementation.
5. **Flakiness risk**: dependence on wall-clock time, real network, filesystem ordering,
   parallel-test shared state, unseeded randomness, or a fixed sleep standing in for a
   condition. Report the mechanism, not just the smell.
6. **Test-only diffs**: judge on 2-5 alone; a diff that only touches tests still has a
   correctness surface.

## Evidence rules

- Cite `file:line`. For a vacuous-assertion finding, state what the test would still pass
  against — that is the proof, and without it the finding is an opinion.
- Judge the tests in the diff. Do not demand tests for code the diff does not touch.
- Do not report a raw coverage number. You cannot measure it from a diff, and a percentage
  without a baseline is not evidence.

## Severity rubric

- **none**: pass with no findings
- **low**: style or naming of an otherwise sound test
- **medium**: missing coverage for a new branch; fixture that overfits the implementation
- **high**: new behaviour with no test at all; a test that cannot fail; a flake mechanism
  that will produce false green in CI
- **critical**: the change disables, skips, or weakens an existing test without justification

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
    description: <what is untested or unfalsifiable, and what it would still pass against>
    suggestion: <optional — one-line fix hint>
```

## Input

<input_yaml/>

## Submit

Write only the YAML above. No prose outside the YAML block.
