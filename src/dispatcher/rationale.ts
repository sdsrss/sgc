// Invariant §11: classifier rationale must reference at least one concrete
// feature of the task (file name, line number, level, risk keyword, blast
// radius number). A bare "looks simple" is rejected.
//
// This is the second half of §11 — the manifest already requires a
// non-empty rationale field (via OutputShapeMismatch on missing); this
// module enforces that the content is specific enough to support
// diagnosis of misclassification later.

export class ClassifierRationaleTooGeneric extends Error {
  constructor(rationale: string) {
    super(
      `classifier rationale too generic (Invariant §11): "${rationale.slice(0, 120)}". ` +
        `Must reference at least one concrete feature — a filename (e.g. ` +
        `foo.ts, plan/SKILL.md), line number (:42), level (L0/L1/L2/L3), ` +
        `risk keyword (auth, schema, migration, typo, format, API, ...), or ` +
        `blast radius ("3 files").`,
    )
    this.name = "ClassifierRationaleTooGeneric"
  }
}

/**
 * Keywords that qualify as "concrete feature" references. Grouped for
 * readability; the validator matches any of them as whole words
 * (case-insensitive).
 */
const CONCRETE_KEYWORDS = [
  // Code surface
  "file", "function", "test", "class", "method", "module", "path",
  "field", "column", "endpoint", "route", "query", "hook", "event",
  "flag", "config", "manifest", "contract", "schema",
  // Change categories
  "typo", "format", "comment", "docstring", "whitespace", "rename",
  "refactor",
  // Risk keywords
  "API", "auth", "authentication", "authorization", "payment", "crypto",
  "jwt", "token", "session", "migration", "ALTER", "DROP", "infra",
  "infrastructure", "deploy", "architecture", "security",
  // sgc domain
  "dispatcher", "classifier", "planner", "reviewer", "qa", "ship",
  "compound", "janitor", "invariant", "scope", "permission",
  // Error / behavior
  "error", "exception", "timeout", "cache", "index", "lock", "branch",
  "null", "undefined", "race",
]

const KEYWORD_RE = new RegExp(
  `\\b(${CONCRETE_KEYWORDS.join("|")})\\b`,
  "i",
)
const FILE_EXT_RE = /\.[a-zA-Z0-9]{1,8}\b/      // foo.ts, plan/SKILL.md
const LINE_NUM_RE = /:\d+\b/                     // :42
const LEVEL_RE = /\bL[0-3]\b/                    // L0/L1/L2/L3
const COUNT_RE = /\b\d+\s*(files?|lines?|tests?|commits?|modules?|functions?)\b/i

/**
 * Return true if the rationale references at least one concrete feature.
 */
export function rationaleIsConcrete(rationale: string): boolean {
  if (typeof rationale !== "string" || rationale.trim().length === 0) return false
  return (
    KEYWORD_RE.test(rationale) ||
    FILE_EXT_RE.test(rationale) ||
    LINE_NUM_RE.test(rationale) ||
    LEVEL_RE.test(rationale) ||
    COUNT_RE.test(rationale)
  )
}

/**
 * Throw ClassifierRationaleTooGeneric if rationale lacks concrete reference.
 */
export function validateClassifierRationale(rationale: string): void {
  if (!rationaleIsConcrete(rationale)) {
    throw new ClassifierRationaleTooGeneric(rationale)
  }
}
