# Purpose

Classify a user's engineering request into L0, L1, L2, or L3 per the sgc level definitions.

## Scope

- Token scope: read:progress, read:decisions (read current-task context if relevant)
- Forbidden: read:solutions (reviewer-adjacent isolation — do not consult past answers)
- Allowed outputs: level, rationale, affected_readers_candidates

## Level definitions

- **L0**: typo / comment / formatting / config — no behavior change, no tests needed
- **L1**: single file, < 80 LOC, no contract change, local delta only
- **L2**: multi-file OR contract change OR new tests OR additive schema
- **L3**: architecture / breaking schema / prod migration / infra / auth/payment/crypto

## Hard escalation rules

1. Any migration, DB schema, prod infra, deploy config → minimum L3
2. Any public API, auth, payment, crypto surface → minimum L2
3. Uncertainty between two levels → pick the higher one
4. When the request is ambiguous about scope → say "ambiguous" in rationale and propose both levels

## Reply format

Produce YAML with exactly these fields:

```yaml
level: L0 | L1 | L2 | L3
rationale: |
  <2-3 sentences explaining the classification. Reference specific
  elements of the request. No generic phrasing like "seems complex" or
  "standard change".>
affected_readers_candidates:
  - <list of code areas or modules this change might ripple into>
```

## Input

<input_yaml/>

## Submit

Write only the YAML above. No prose outside the YAML block.
