// P2-7: the leak-check fingerprint cache is keyed by stateRoot and never
// invalidated except explicitly, so a long-running / embedded process that
// compounds a solution and then reviews in the SAME process would leak-check
// against a stale corpus. writeSolution now clears the cache; these tests
// exercise the underlying invalidation hooks against a real tmp corpus.

import { afterEach, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  clearFingerprintCache,
  getFingerprintsCached,
  invalidateFingerprintCache,
} from "../../src/dispatcher/fingerprint"

afterEach(() => clearFingerprintCache())

function seed(root: string, slug: string, line: string): void {
  const dir = join(root, "solutions", "runtime")
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${slug}.md`), `---\nx: 1\n---\n${line}\n`, "utf8")
}

test("caches per stateRoot; invalidate forces a rebuild that sees new corpus content", () => {
  const root = mkdtempSync(join(tmpdir(), "sgc-fp-"))
  try {
    seed(root, "a", "a sufficiently long fingerprintable solution line about retry backoff")
    const fp1 = getFingerprintsCached(root)
    const size1 = fp1.size
    expect(size1).toBeGreaterThan(0)

    // Add corpus content WITHOUT invalidating — same cached Set, stale.
    seed(root, "b", "another long fingerprintable line about file locking and atomic writes")
    expect(getFingerprintsCached(root)).toBe(fp1)

    // Targeted invalidation → next call rebuilds and reflects the new file.
    invalidateFingerprintCache(root)
    const fp2 = getFingerprintsCached(root)
    expect(fp2).not.toBe(fp1)
    expect(fp2.size).toBeGreaterThan(size1)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("clearFingerprintCache drops every entry", () => {
  const root = mkdtempSync(join(tmpdir(), "sgc-fp-"))
  try {
    seed(root, "a", "a long fingerprintable line for the clear-all cache scenario here")
    const fp1 = getFingerprintsCached(root)
    clearFingerprintCache()
    expect(getFingerprintsCached(root)).not.toBe(fp1)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
