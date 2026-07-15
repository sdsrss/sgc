// Term lists as data — the source both the matcher regex and the advertised
// term list in an agent's description are built from.
//
// Why this exists: through v1.35.0 the term list lived hand-written in
// plugins/sgc/agents/reviewer/*.md while the regex lived here, three files away.
// They disagreed twice — the description omitted signature|encrypt|decrypt, and
// advertised an O(n) term the regex could not match in any natural context.
// Inverting the dependency makes that class of defect unrepresentable.

/**
 * `display` is what a human sees advertised; `re` is what actually matches;
 * `wordBounded` decides which side of the \b(...)\b group it lands on.
 *
 * The split matters: a \b after a literal ')' requires a word character next, so
 * `O\(n\)` inside \b(...)\b matched "O(n)x" and nothing a human would ever write.
 */
export type Term = { display: string; re: string; wordBounded: boolean }

/** Build the matcher: \b(bounded|terms)\b|unbounded|terms */
export function buildPattern(terms: readonly Term[], flags = "i"): RegExp {
  if (terms.length === 0) {
    throw new Error("buildPattern needs at least one term — an empty alternation matches everything")
  }
  const bounded = terms.filter((t) => t.wordBounded).map((t) => t.re)
  const free = terms.filter((t) => !t.wordBounded).map((t) => t.re)
  const parts: string[] = []
  if (bounded.length > 0) parts.push(`\\b(${bounded.join("|")})\\b`)
  if (free.length > 0) parts.push(free.join("|"))
  return new RegExp(parts.join("|"), flags)
}

/** The advertised list, e.g. "auth|jwt|token". Display names, never `re`. */
export function displayList(terms: readonly Term[]): string {
  return terms.map((t) => t.display).join("|")
}
