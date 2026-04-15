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

  const enumMatch = /^enum\[(.+)\]$/.exec(decl)
  if (enumMatch) {
    const values = enumMatch[1]!.split(",").map((v) => v.trim())
    if (typeof value !== "string" || !values.includes(value)) {
      return `field ${fieldName}: expected one of [${values.join(", ")}], got ${JSON.stringify(value)}`
    }
    return null
  }

  if (/^array\[(.+)\]$/.test(decl)) {
    if (!Array.isArray(value)) {
      return `field ${fieldName}: expected array, got ${typeof value}`
    }
    return null
  }

  if (decl === "string" || decl === "markdown") {
    if (typeof value !== "string") {
      return `field ${fieldName}: expected string, got ${typeof value}`
    }
    return null
  }

  if (decl === "integer" || decl === "number") {
    if (typeof value !== "number") {
      return `field ${fieldName}: expected number, got ${typeof value}`
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
