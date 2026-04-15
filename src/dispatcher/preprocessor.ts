// YAML preprocessor for sgc spec DSL.
//
// The contract YAML files (sgc-capabilities.yaml, sgc-state.schema.yaml) use
// human-readable shorthand that is not strict YAML and breaks safe_load:
//
//   1. `array[T]`  — type shorthand inside flow-mappings
//                     e.g. `affected_readers: { type: array[string], ... }`
//   2. `array[{a, b}]` — array-of-object shorthand (nested brackets)
//                     e.g. `findings: array[{location, description, suggestion?}]`
//   3. `name?`      — optional-field marker inside flow-sequences
//                     e.g. `items: [source, excerpt, solution_ref?]`
//
// preprocess() returns YAML text where these patterns are quoted as strings.
// The parsed object tree then carries them as opaque string values; downstream
// code (schema.ts) interprets them when needed.
//
// Rule for inclusion: only transform what causes safe_load to throw. We keep
// human-readable form by quoting rather than rewriting.

import { load as yamlLoad } from "js-yaml"

/**
 * Quote `array[...]` substrings (with balanced brackets) so the value parses
 * as a string instead of a malformed flow-sequence-inside-flow-mapping.
 */
function quoteArrayPatterns(input: string): string {
  const out: string[] = []
  let i = 0
  while (i < input.length) {
    const start = input.indexOf("array[", i)
    if (start === -1 || !isWordBoundary(input, start)) {
      out.push(input.slice(i))
      break
    }
    out.push(input.slice(i, start))
    // Balance brackets starting at `[`
    let depth = 0
    let j = start + "array".length
    while (j < input.length) {
      const c = input[j]
      if (c === "[") depth++
      else if (c === "]") {
        depth--
        if (depth === 0) break
      }
      j++
    }
    if (j >= input.length) {
      // Unbalanced — bail without transforming.
      out.push(input.slice(start))
      break
    }
    out.push(`"${input.slice(start, j + 1)}"`)
    i = j + 1
  }
  return out.join("")
}

function isWordBoundary(s: string, idx: number): boolean {
  if (idx === 0) return true
  const prev = s[idx - 1]
  // Treat `"` as non-boundary so that an already-quoted "array[...]"
  // (idempotent re-run) is skipped instead of double-quoted.
  return !/[A-Za-z0-9_"]/.test(prev)
}

/**
 * Inside flow-sequences `[...]`, quote any bare `word?` token so YAML doesn't
 * choke on `?` (which is the complex-mapping-key indicator).
 *
 * Conservative: only acts on flow-sequences that don't span newlines. Iterates
 * to handle multiple `?` tokens in one sequence.
 */
function quoteOptionalTokens(input: string): string {
  let prev = ""
  let s = input
  while (prev !== s) {
    prev = s
    s = s.replace(/(\[[^\[\]\n]*?)\b(\w+)\?(?=[\s,\]])/g, '$1"$2?"')
  }
  return s
}

/**
 * Detect a line that opens a block scalar:
 *   key: |       (literal)
 *   key: >       (folded)
 *   key: |-      (chomp)
 *   key: |+      (keep)
 * Returns the parent-key indent so callers can detect when the block ends
 * (any line indented MORE belongs to the block; less or equal exits it).
 */
function blockScalarOpenIndent(line: string): number | null {
  // Match: leading whitespace, key chars, ":", optional space, `|` or `>`,
  // optional `-` or `+`, trailing space, then end-of-line or comment.
  const m = /^(\s*)\S[^:]*:\s*[|>][-+]?\s*(#.*)?$/.exec(line)
  if (!m) return null
  return m[1]!.length
}

/**
 * Apply DSL → strict YAML transformations. Line-by-line so block scalars
 * (`key: |` / `key: >`) can pass through untouched — preserves literal
 * `array[X]` or `name?` text appearing in documentation/notes/rationale
 * fields. Audit C-phase I1 fix.
 *
 * Idempotent.
 */
export function preprocess(yamlText: string): string {
  const lines = yamlText.split("\n")
  const out: string[] = []
  let blockIndent: number | null = null

  for (const line of lines) {
    const indent = line.length - line.trimStart().length
    const isBlank = line.trim() === ""

    if (blockIndent !== null) {
      // Inside a block scalar: pass through as-is until indent retreats.
      if (isBlank || indent > blockIndent) {
        out.push(line)
        continue
      }
      blockIndent = null
      // Fall through to process this line normally.
    }

    const open = blockScalarOpenIndent(line)
    if (open !== null) {
      blockIndent = open
      out.push(line)
      continue
    }

    let processed = quoteArrayPatterns(line)
    processed = quoteOptionalTokens(processed)
    out.push(processed)
  }

  return out.join("\n")
}

/**
 * Convenience: preprocess + parse. Returns the parsed object tree (with
 * shorthand strings still in place — call decoders separately).
 */
export function loadSpec<T = unknown>(yamlText: string): T {
  const preprocessed = preprocess(yamlText)
  return yamlLoad(preprocessed) as T
}
