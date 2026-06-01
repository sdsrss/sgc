// Extracted from spawn.ts in D-1.1 so both spawn.ts and commands/agent-loop.ts
// can validate outputs without a circular import.
//
// Invariant §9: "the dispatcher discards any produced content that does not
// match the declared output shape." We throw rather than silently strip so
// bugs are visible at dev time.

import type { SubagentManifest } from "./types"

export class OutputShapeMismatch extends Error {
  constructor(
    public readonly agent: string,
    public readonly fields: string[],
    detail?: string,
  ) {
    super(detail ?? `agent ${agent} output missing required fields: ${fields.join(", ")}`)
    this.name = "OutputShapeMismatch"
  }
}

/**
 * Type-check one value against its declared DSL form. Returns an error string
 * or null on OK. Handles the post-preprocessor form: "enum[A, B]",
 * "array[T]" (quoted), "markdown", "string", "integer".
 */
export function validateValueAgainstDecl(
  value: unknown,
  decl: unknown,
  fieldName: string,
): string | null {
  if (typeof decl !== "string") return null  // complex declaration — defer

  // ALG-2: match `enum[...]` including the empty `enum[]` form. A declaration
  // with no (non-empty) members can never be satisfied — pre-fix `/.+/` failed
  // to match `enum[]`, so it fell through to "unknown declaration → accept
  // anything", silently letting an empty-enum field accept any value.
  const enumMatch = /^enum\[(.*)\]$/.exec(decl)
  if (enumMatch) {
    const values = enumMatch[1]!.split(",").map((v) => v.trim()).filter((v) => v.length > 0)
    if (values.length === 0) {
      return `field ${fieldName}: malformed declaration ${JSON.stringify(decl)} (enum declares no values)`
    }
    if (typeof value !== "string" || !values.includes(value)) {
      return `field ${fieldName}: expected one of [${values.join(", ")}], got ${JSON.stringify(value)}`
    }
    return null
  }

  const arrayMatch = /^array\[(.+)\]$/.exec(decl)
  if (arrayMatch) {
    if (!Array.isArray(value)) {
      return `field ${fieldName}: expected array, got ${typeof value}`
    }
    // Recurse on inner type T when it is a simple form we know how to
    // check (string / markdown / integer / number / enum[...]). Composite
    // forms like `{area, risk, mitigation}` stay manifest-untyped here —
    // shape enforcement for `array[{...}]` outputs is delegated to
    // `composeArrayObjectValidator` below, which agents wire up at the
    // call site (researcher.history is the first consumer; planner.eng /
    // compound.context will migrate when their LLM-mode coerce lands).
    //
    // Pre-G.3 (DF-2 fix): this branch only checked Array.isArray, which
    // let `concerns: [{area, risk, mitigation}]` slip past `array[string]`
    // declaration on planner.eng — that is the F-2 root cause.
    const innerDecl = arrayMatch[1]!.trim()
    const isSimpleForm =
      innerDecl === "string" ||
      innerDecl === "markdown" ||
      innerDecl === "integer" ||
      innerDecl === "number" ||
      /^enum\[.+\]$/.test(innerDecl)
    if (!isSimpleForm) return null
    for (let i = 0; i < value.length; i++) {
      const err = validateValueAgainstDecl(value[i], innerDecl, `${fieldName}[${i}]`)
      if (err) return err
    }
    return null
  }

  if (decl === "string" || decl === "markdown") {
    if (typeof value !== "string") {
      return `field ${fieldName}: expected string, got ${typeof value}`
    }
    return null
  }

  if (decl === "integer") {
    // ALG-2: pre-fix only checked `typeof === "number"`, so 3.7, NaN, and
    // Infinity all passed as "integer". Number.isInteger rejects all three
    // (and non-numbers) in one check.
    if (!Number.isInteger(value)) {
      return `field ${fieldName}: expected integer, got ${JSON.stringify(value)}`
    }
    return null
  }

  if (decl === "number") {
    // ALG-2: accept any finite number (floats OK) but reject NaN / Infinity,
    // matching the finite-number-range FieldSpec path's rigor.
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return `field ${fieldName}: expected finite number, got ${JSON.stringify(value)}`
    }
    return null
  }

  return null  // unknown declaration form — don't reject
}

/**
 * Full Invariant §9 check: presence, undeclared-rejection, type.
 *
 * When the manifest does NOT declare `outputs`, the agent's shape is
 * unconstrained (MVP behavior — e.g. compound.* which share a base
 * template without explicit output types). Non-object results still
 * throw because "result not an object" is a protocol violation, not
 * a schema gap.
 */
export function validateOutputShape(manifest: SubagentManifest, result: unknown): void {
  if (typeof result !== "object" || result === null) {
    throw new OutputShapeMismatch(
      manifest.name,
      Object.keys((manifest.outputs ?? {}) as object),
    )
  }
  const hasDeclaredOutputs =
    manifest.outputs !== undefined &&
    manifest.outputs !== null &&
    Object.keys(manifest.outputs as object).length > 0
  if (!hasDeclaredOutputs) {
    // Manifest didn't declare any outputs — nothing to validate against.
    return
  }
  const expected = manifest.outputs as Record<string, unknown>
  const required = Object.keys(expected)
  const present = Object.keys(result as Record<string, unknown>)

  const missing = required.filter((k) => !present.includes(k))
  if (missing.length > 0) {
    throw new OutputShapeMismatch(manifest.name, missing)
  }

  const unknown = present.filter((k) => !required.includes(k))
  if (unknown.length > 0) {
    throw new OutputShapeMismatch(
      manifest.name,
      unknown,
      `agent ${manifest.name} returned undeclared output fields: ${unknown.join(", ")} (Invariant §9)`,
    )
  }

  const typeErrors: string[] = []
  for (const [field, decl] of Object.entries(expected)) {
    const err = validateValueAgainstDecl(
      (result as Record<string, unknown>)[field],
      decl,
      field,
    )
    if (err) typeErrors.push(err)
  }
  if (typeErrors.length > 0) {
    throw new OutputShapeMismatch(
      manifest.name,
      typeErrors,
      `agent ${manifest.name} output type errors: ${typeErrors.join("; ")}`,
    )
  }
}

// --- composeArrayObjectValidator ----------------------------------------
//
// Generalizes the post-spawn `coerceLlmOutput` pattern that Phase H wired up
// in researcher-history.ts. Pre-DSL each LLM-mode agent that emits
// `array[{...}]` re-implemented the same 6 guards (top-level array check,
// per-entry object check, per-field type checks, cross-field validation,
// dedup-first-wins, truncate-to-N). Centralizing them lets new LLM agents
// declare a shape and inherit the audit-event-friendly OutputShapeMismatch
// throws + dedup warning convention.
//
// Scope: structural validation + dedup + truncate. Field-value transforms
// (markdown-escape, whitespace fold, context-aware back-fill) stay in the
// caller — the DSL hands back validated raw entries so callers retain full
// type control of the final shape.

/** Per-field type spec — applied in `fields` declaration order. */
export type FieldSpec =
  | { kind: "string" }
  | { kind: "string-in-set"; set: ReadonlySet<string> }
  | { kind: "finite-number-range"; min: number; max: number }
  | { kind: "optional-non-empty-string" }
  /** Escape hatch when a field needs context only the caller has. */
  | { kind: "custom"; check: (value: unknown) => string | null }

export interface ArrayObjectShape {
  /** Surfaced in OutputShapeMismatch — e.g. "researcher.history". */
  agentName: string
  /** Top-level field on the outer object — e.g. "prior_art". */
  topField: string
  /** Per-field structural checks. Insertion order is the check order. */
  fields: Record<string, FieldSpec>
  /**
   * Cross-field hook, runs after `fields` pass for one entry. Return a
   * non-null string to fail validation with that message; null to accept.
   * Used for constraints that reference multiple fields (e.g. "X must be
   * ≥ T when Y is present"). The hook sees the raw entry — values have
   * passed structural checks but are not yet narrowed by TypeScript.
   */
  validateEntry?: (entry: Record<string, unknown>, index: number) => string | null
  /** Field name used for dedup — first occurrence wins. Must appear in `fields`. */
  dedupBy?: string
  /** Hard cap on output length — applied after dedup. Truncation is silent. */
  maxLength?: number
  /** Singular noun for the dedup warning ("entry" / "entries"). Default "entry". */
  dedupNoun?: string
}

export interface ArrayObjectValidationResult {
  /** Validated raw entries, post-dedup, post-truncate. Caller maps to typed shape. */
  entries: Record<string, unknown>[]
  /** LLM-passthrough warnings (raw.warnings filtered to strings) + DSL dedup warning. */
  warnings: string[]
}

function checkField(value: unknown, spec: FieldSpec): string | null {
  switch (spec.kind) {
    case "string":
      return typeof value === "string" ? null : `expected string, got ${typeof value}`
    case "string-in-set":
      if (typeof value !== "string") return `expected string, got ${typeof value}`
      return spec.set.has(value) ? null : `${JSON.stringify(value)} not in allowed set`
    case "finite-number-range":
      if (typeof value !== "number" || !Number.isFinite(value) || value < spec.min || value > spec.max) {
        return `must be finite number in [${spec.min}, ${spec.max}], got ${
          typeof value === "number" ? String(value) : JSON.stringify(value)
        }`
      }
      return null
    case "optional-non-empty-string":
      if (value === undefined) return null
      if (typeof value !== "string" || value.trim().length === 0) {
        return `must be non-empty string when present`
      }
      return null
    case "custom":
      return spec.check(value)
  }
}

/**
 * Compose a validator for the `{ <topField>: [{...}], warnings: [string] }`
 * shape. Returns a function that throws `OutputShapeMismatch` on structural
 * failure and returns `{ entries, warnings }` on success.
 */
export function composeArrayObjectValidator(
  shape: ArrayObjectShape,
): (raw: unknown) => ArrayObjectValidationResult {
  const fieldEntries = Object.entries(shape.fields)
  const dedupNoun = shape.dedupNoun ?? "entry"
  const dedupPlural = dedupNoun === "entry" ? "entries" : `${dedupNoun}s`

  return function validateArrayObject(raw: unknown): ArrayObjectValidationResult {
    if (typeof raw !== "object" || raw === null) {
      throw new OutputShapeMismatch(
        shape.agentName,
        [shape.topField],
        `${shape.agentName} output not an object`,
      )
    }
    const obj = raw as Record<string, unknown>
    const arr = obj[shape.topField]
    if (!Array.isArray(arr)) {
      throw new OutputShapeMismatch(
        shape.agentName,
        [shape.topField],
        `${shape.agentName}.${shape.topField} expected array, got ${typeof arr}`,
      )
    }

    const seen = shape.dedupBy ? new Set<string>() : null
    let dedupedCount = 0
    const entries: Record<string, unknown>[] = []

    for (let i = 0; i < arr.length; i++) {
      if (shape.maxLength !== undefined && entries.length >= shape.maxLength) break
      const e = arr[i]
      if (typeof e !== "object" || e === null) {
        throw new OutputShapeMismatch(
          shape.agentName,
          [`${shape.topField}[${i}]`],
          `${shape.topField}[${i}] not an object`,
        )
      }
      const entry = e as Record<string, unknown>

      // Per-field structural checks, in declaration order.
      for (const [fieldName, spec] of fieldEntries) {
        const err = checkField(entry[fieldName], spec)
        if (err !== null) {
          throw new OutputShapeMismatch(
            shape.agentName,
            [`${shape.topField}[${i}].${fieldName}`],
            `${shape.topField}[${i}].${fieldName} ${err}`,
          )
        }
      }

      // Cross-field hook.
      if (shape.validateEntry) {
        const err = shape.validateEntry(entry, i)
        if (err !== null) {
          throw new OutputShapeMismatch(
            shape.agentName,
            [`${shape.topField}[${i}]`],
            `${shape.topField}[${i}].${err}`,
          )
        }
      }

      // Dedup — first wins. Subsequent dups counted, dropped silently.
      if (seen !== null) {
        const key = entry[shape.dedupBy!] as string
        if (seen.has(key)) {
          dedupedCount++
          continue
        }
        seen.add(key)
      }

      entries.push(entry)
    }

    const llmWarnings = Array.isArray(obj["warnings"])
      ? (obj["warnings"].filter((w) => typeof w === "string") as string[])
      : []
    const warnings = [...llmWarnings]
    if (dedupedCount > 0) {
      const noun = dedupedCount === 1 ? dedupNoun : dedupPlural
      warnings.push(
        `LLM emitted ${dedupedCount} duplicate ${shape.dedupBy} ${noun}; deduped to ${entries.length} unique`,
      )
    }

    return { entries, warnings }
  }
}
