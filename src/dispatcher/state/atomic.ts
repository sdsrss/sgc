// Shared state-layer primitives: root resolution, frontmatter (de)serialization,
// visibility-atomic writes, and the ICU word counter. Every per-layer module
// (decisions / progress / solutions / reviews) builds on these; keeping them in
// one place is why the layer files stay free of duplicated I/O plumbing.
//
// Split out of the former monolithic state.ts (ARCH-3, audit v1.37.0 C10). The
// public import surface is preserved by the ./..​/state.ts barrel — consumers
// still `import { … } from "…/dispatcher/state"`.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { randomBytes } from "node:crypto"
import { dirname, resolve } from "node:path"
import { dump as yamlDump, load as yamlLoad } from "js-yaml"

export class StateError extends Error {
  constructor(
    public readonly code:
      | "NoFrontmatter"
      | "SchemaViolation"
      | "IntentImmutable"
      | "ShipImmutable"
      | "AppendOnly"
      | "NotFound"
      | "SolutionDeleteForbidden"
      | "DedupStampMissing",
    message: string,
  ) {
    super(message)
    this.name = "StateError"
  }
}

const DEFAULT_STATE_DIR = ".sgc"

// CE-1.1 (DRY): exported variant for cross-module reuse. preventions.ts +
// researcher-history.ts both resolve the 3-step fallback (explicit arg →
// SGC_STATE_ROOT env → ".sgc") and previously inlined identical code at
// 3 sites. Centralizing here prevents call sites from silently bypassing
// the env var (T6 review C-1) and ensures resolve() canonicalizes to an
// absolute path uniformly.
export function resolveStateRoot(custom?: string): string {
  return resolve(custom ?? process.env["SGC_STATE_ROOT"] ?? DEFAULT_STATE_DIR)
}

const root = resolveStateRoot

const LAYERS = ["decisions", "progress", "solutions", "reviews"] as const

// When sgc creates its default `.sgc/` state dir inside a git repo, make sure
// the repo ignores it. The README promises `.sgc/` is runtime state (not
// source); without this a fresh `git add -A` commits decisions/, the event
// stream, and agent prompts — and `sgc review` then flags sgc's own internal
// TODO markers as findings. Idempotent (only appends when no matching rule
// exists) and scoped to the implicit default location at a repo root: a custom
// arg or SGC_STATE_ROOT may point outside the repo (e.g. a temp dir), so those
// stay the operator's responsibility. Best-effort — never breaks a command.
function ensureDefaultStateGitignored(custom: string | undefined): void {
  if (custom !== undefined || process.env["SGC_STATE_ROOT"]) return
  if (!existsSync(resolve(".git"))) return // only at a git repo root
  const giPath = resolve(".gitignore")
  let content = ""
  try {
    content = readFileSync(giPath, "utf8")
  } catch {
    // no .gitignore yet — we'll create one
  }
  const alreadyIgnored = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .some(
      (l) => l === ".sgc" || l === ".sgc/" || l === "/.sgc" || l === "/.sgc/",
    )
  if (alreadyIgnored) return
  const lead = content.length === 0 ? "" : content.endsWith("\n") ? "\n" : "\n\n"
  const block = `${lead}# sgc runtime state (not source) — safe to delete; recreated on next run\n.sgc/\n`
  try {
    writeFileSync(giPath, content + block)
  } catch {
    // read-only .gitignore / FS — degrade silently rather than fail the command
  }
}

export function ensureSgcStructure(stateRoot?: string): string {
  const r = root(stateRoot)
  for (const layer of LAYERS) {
    mkdirSync(resolve(r, layer), { recursive: true })
  }
  ensureDefaultStateGitignored(stateRoot)
  return r
}

// Frontmatter ────────────────────────────────────────────────────────────────

export interface FrontmatterFile<T> {
  data: T
  body: string
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

export function parseFrontmatter<T = Record<string, unknown>>(
  text: string,
  source?: string,
): FrontmatterFile<T> {
  const match = FRONTMATTER_RE.exec(text)
  if (!match) {
    // A truncated / partially-written / hand-corrupted state file lands here.
    // When the caller passes its path, name it and point at recovery — `.sgc/`
    // is regenerable runtime state, so the fix is usually "delete and re-run".
    const where = source ? `${source}: ` : ""
    const hint = source
      ? " — corrupt or partially written; .sgc/ is regenerable runtime state (delete it and re-run, or restore this file)"
      : ""
    throw new StateError("NoFrontmatter", `${where}file missing YAML frontmatter${hint}`)
  }
  const data = (yamlLoad(match[1]!) ?? {}) as T
  // Strip leading blank lines that the serializer adds for visual spacing,
  // so round-trip preserves the original body.
  const body = (match[2] ?? "").replace(/^\n+/, "")
  return { data, body }
}

export function serializeFrontmatter(
  data: Record<string, unknown>,
  body = "",
): string {
  const yaml = yamlDump(data, { lineWidth: -1, sortKeys: false }).trimEnd()
  const trimmedBody = body.replace(/^\n+/, "")
  return `---\n${yaml}\n---\n\n${trimmedBody}`
}

// Monotonic per-process counter — guarantees distinct tmp names even for two
// writeAtomic calls landing in the same millisecond on the same pid.
let atomicWriteSeq = 0

/**
 * Write via tmp + rename. "Atomic" here means VISIBILITY-atomic: a concurrent
 * reader sees either the whole old file or the whole new one, never a torn
 * write. That is the property every caller actually needs — `--resume` re-reads
 * checkpoints, and a half-serialized run file surfaces as MalformedRunFile.
 *
 * P3-7 (audit v1.31.8) — the fsync question, decided and documented rather than
 * left implicit: there is deliberately NO fsync before the rename, so this is
 * not durable against power loss. The rename may be journaled while the data
 * blocks are not yet flushed, and the file can come back empty or stale after
 * a hard crash.
 *
 * That is the right trade for what this stores. `.sgc/` is developer-local
 * workflow state: losing an intent.md to a power cut costs one `sgc plan`
 * re-run, and the append-only knowledge corpus is rebuilt from tasks, not
 * relied on as a system of record. Paying an fsync (a real disk flush) on every
 * state write — and there are many per task — to protect against a failure mode
 * whose recovery is "run the command again" would be a bad bargain.
 *
 * If sgc ever stores something whose loss is NOT re-derivable, revisit this:
 * the fix is fsync on the tmp fd before renameSync, plus an fsync of the parent
 * directory to persist the rename itself.
 */
export function writeAtomic(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  // STAB-4: pid+Date.now() alone collides on same-ms writes and (across pid
  // recycling) on stale tmp names. Append a monotonic counter + random suffix
  // so every tmp path is unique.
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}.${atomicWriteSeq++}.${randomBytes(4).toString("hex")}`
  writeFileSync(tmp, content, "utf8")
  try {
    renameSync(tmp, path)
  } catch (err) {
    // STAB-4: renameSync failed (EISDIR / EXDEV / EPERM …) — the tmp file would
    // otherwise leak as residue. Best-effort unlink, then rethrow the original.
    try {
      unlinkSync(tmp)
    } catch {
      // tmp already gone or unremovable — nothing more to do.
    }
    throw err
  }
}

// ICU-segmented word count. Mirrors src/dispatcher/dedup.ts (Phase G
// Unicode hotfix, Appendix A): `Intl.Segmenter` with `word` granularity
// + `isWordLike` filter handles EN / CJK / Thai / Arabic uniformly. The
// pre-G.3 implementation used `text.trim().split(/\s+/)`, which collapsed
// CJK runs to a single token and rejected valid Chinese motivations
// under the 20-word floor (G.3 Track 1 finding F-1).
const WORD_SEGMENTER = new Intl.Segmenter([], { granularity: "word" })

export function wordCount(text: string): number {
  let n = 0
  for (const seg of WORD_SEGMENTER.segment(text)) {
    if (seg.isWordLike) n++
  }
  return n
}
