// GS-1.1 promote (sibling spec tasks/specs/gs-1-promote.md) —
// promoteCanaryFailure tests. RED-first: all of these fail before the
// new module exists; they pin Invariant §3 + idempotency semantics +
// the phase-disambiguation slug shape that distinguishes GS-1.1 from
// CE-3-promote (which doesn't carry a phase dimension).

import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  promoteCanaryFailure,
  PromoteCanaryError,
} from "../../src/dispatcher/canary-promote"
import { computeSignature } from "../../src/dispatcher/dedup"
import {
  ensureSgcStructure,
  parseFrontmatter,
  serializeFrontmatter,
  writeSolution,
} from "../../src/dispatcher/state"
import type { DedupStamp, SolutionEntry } from "../../src/dispatcher/types"
import { seedRelatedSpawn } from "../fixtures/related-spawn"

let stateRoot: string

beforeEach(() => {
  stateRoot = mkdtempSync(join(tmpdir(), "sgc-canary-promote-"))
  ensureSgcStructure(stateRoot)
  // §3 (P2-6): the seed stamp's compound.related spawn must exist on disk.
  seedRelatedSpawn(stateRoot)
})

afterEach(() => {
  rmSync(stateRoot, { recursive: true, force: true })
})

// ── fixtures ────────────────────────────────────────────────────────────────

interface CanaryFailureFixture {
  slug?: string
  regression_seed?: string
  promoted_to?: string
  package_name?: string
  expected_version?: string
  failed_phase?: "npm_propagation" | "smoke_install" | "health_url"
  commit_sha?: string
  health_url?: string
  phase_output?: string
}

/**
 * Write a `<stateRoot>/canaries/<slug>.md` mirroring the shape produced
 * by captureCanaryFailure but parameterized for test control. Defaults
 * are valid for happy-path promote (regression_seed edited).
 */
function writeCanaryFixture(opts: CanaryFailureFixture = {}): {
  slug: string
  path: string
} {
  const sha = opts.commit_sha ?? "c29f021696993ea96ab93b3ba7179e3b6b6ef745"
  const shortSha = sha.slice(0, 7)
  const phase = opts.failed_phase ?? "smoke_install"
  const slug = opts.slug ?? `2026-05-25-${shortSha}-${phase}`
  const dir = join(stateRoot, "canaries")
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `${slug}.md`)
  const fm: Record<string, unknown> = {
    kind: "canary-failure",
    captured_at: "2026-05-25T09:46:10.694Z",
    commit_sha: sha,
    tag: "v1.11.0",
    package_name: opts.package_name ?? "@sdsrs/sgc",
    expected_version: opts.expected_version ?? "1.11.0",
    failed_phase: phase,
    health_url: opts.health_url ?? "(none)",
    regression_seed:
      opts.regression_seed ??
      "Use isolated `npm install --prefix <mkdtemp>` for version-verification tooling; `npx --yes pkg@ver` PATH-shadows when bin exists on PATH.",
  }
  if (opts.promoted_to !== undefined) {
    fm["promoted_to"] = opts.promoted_to
  }
  const body = [
    "## Failure context",
    "",
    `- package:    ${fm["package_name"]}`,
    `- version:    ${fm["expected_version"]}`,
    `- phase:      ${fm["failed_phase"]}`,
    `- commit:     ${fm["commit_sha"]}`,
    "",
    "## Phase output excerpt",
    "",
    opts.phase_output ?? "exitCode=0 but stdout missing 1.11.0; stdout=1.3.0",
    "",
    "## Next steps for operator",
    "",
    "- Reproduce the failing phase locally with the same arguments.",
    "",
  ].join("\n")
  writeFileSync(path, serializeFrontmatter(fm, body), "utf8")
  return { slug, path }
}

const OK_STAMP: DedupStamp = {
  compound_related_spawn_id: "01TESTSTAMP0000000000-compound.related",
  threshold_met_or_forced: true,
  reason: "new_entry",
}

function seedExistingSolutionWithSameProblem(problem: string): void {
  // Signature equality wins inside similarity() — pin the seed signature
  // to computeSignature(problem) so the promote helper's candidate
  // collides at score 1.0 regardless of tag jaccard. Mirrors
  // compound-promote.test.ts pattern.
  const entry: SolutionEntry = {
    id: "01HEXISTING0000000000000000",
    signature: computeSignature(problem),
    category: "other",
    problem,
    symptoms: ["matches the to-be-promoted canary record"],
    what_didnt_work: [],
    solution: "(seeded)",
    prevention: "(seeded prevention text)",
    tags: ["untagged"],
    first_seen: "2026-05-25T00:00:00Z",
    last_updated: "2026-05-25T00:00:00Z",
    times_referenced: 0,
    source_task_ids: ["01HOLDTASK000000000000000"],
  }
  writeSolution(entry, "seeded-duplicate", OK_STAMP, "", stateRoot)
}

// ── tests ────────────────────────────────────────────────────────────────

describe("promoteCanaryFailure — error paths (GS-1.1 T1–T4)", () => {
  it("T1: missing canary file → PromoteCanaryError MissingCanaryFailure", async () => {
    await expect(
      promoteCanaryFailure({ slug: "does-not-exist", stateRoot }),
    ).rejects.toMatchObject({
      code: "MissingCanaryFailure",
    })
  })

  it("T2: placeholder regression_seed (TODO: operator-fill) → PlaceholderRegressionSeed", async () => {
    writeCanaryFixture({
      regression_seed:
        "TODO: operator-fill; canary failed at smoke_install for @sdsrs/sgc@1.11.0 on c29f021. Convert via `sgc compound --from-canary <slug>` (pending GS-1.1).",
    })
    await expect(
      promoteCanaryFailure({
        slug: "2026-05-25-c29f021-smoke_install",
        stateRoot,
      }),
    ).rejects.toMatchObject({
      code: "PlaceholderRegressionSeed",
    })
  })

  it("T3: already-promoted (promoted_to: set) → AlreadyPromoted", async () => {
    writeCanaryFixture({
      promoted_to: "build/some-earlier-canary-slug",
    })
    await expect(
      promoteCanaryFailure({
        slug: "2026-05-25-c29f021-smoke_install",
        stateRoot,
      }),
    ).rejects.toMatchObject({
      code: "AlreadyPromoted",
    })
  })

  it("T4: dedup match with no --force → DuplicateMatch; no solutions/ write; no canary mutation", async () => {
    const fix = writeCanaryFixture({
      phase_output: "PROPAGATION FAILURE: npm registry returned 503",
    })
    const fileBefore = readFileSync(fix.path, "utf8")
    // Seed an existing solution whose problem field matches the
    // problem_summary that compoundContextHeuristic will derive from
    // the canary intent payload. The promote helper hands
    // `<phaseOutput>\n\n<packageName> <failedPhase>` to
    // compoundContextHeuristic; problem_summary = input.slice(0,400).trim().
    seedExistingSolutionWithSameProblem(
      "PROPAGATION FAILURE: npm registry returned 503\n\n@sdsrs/sgc smoke_install",
    )
    await expect(
      promoteCanaryFailure({ slug: fix.slug, stateRoot }),
    ).rejects.toMatchObject({ code: "DuplicateMatch" })
    // Refuse path file-level invariants:
    expect(readFileSync(fix.path, "utf8")).toBe(fileBefore)
  })
})

describe("promoteCanaryFailure — happy path (GS-1.1 T5)", () => {
  it("T5: writes new solution at canary-<short-sha>-<phase>; canary file gains promoted_to; dedupAction=new_entry; prevention = operator seed", async () => {
    const seedText =
      "Use isolated `npm install --prefix <mkdtemp>` for version-verification tooling; `npx --yes pkg@ver` PATH-shadows when bin exists on PATH. See feedback_npx_path_shadow memory."
    const fix = writeCanaryFixture({
      phase_output: "FRESH CANARY: no prior corpus collisions here",
      regression_seed: seedText,
    })
    const r = await promoteCanaryFailure({ slug: fix.slug, stateRoot })
    expect(r.dedupAction).toBe("new_entry")
    expect(r.canaryPath).toBe(fix.path)
    // Default solution slug shape: canary-<short-sha>-<phase> (preserves
    // GS-1 (sha, phase) dedup key — distinguishes from CE-3-promote
    // ship-failure-<short-sha> single-key shape).
    expect(r.solutionPath).toMatch(
      /\/solutions\/[^/]+\/canary-c29f021-smoke_install\.md$/,
    )
    expect(existsSync(r.solutionPath)).toBe(true)
    // Solution's prevention field is the operator's edited seed verbatim.
    const sol = parseFrontmatter<SolutionEntry>(
      readFileSync(r.solutionPath, "utf8"),
    )
    expect(sol.data.prevention).toContain(
      "isolated `npm install --prefix <mkdtemp>`",
    )
    expect(sol.data.prevention).toContain("PATH-shadows")
    // Canary file gained promoted_to: pointing at <category>/<slug>
    // (corpus-portable, not absolute path).
    const cf = parseFrontmatter<Record<string, unknown>>(
      readFileSync(fix.path, "utf8"),
    )
    expect(typeof cf.data["promoted_to"]).toBe("string")
    const promotedRef = cf.data["promoted_to"] as string
    expect(promotedRef.split("/").length).toBe(2) // <category>/<slug>
    expect(promotedRef).toContain("canary-c29f021-smoke_install")
    expect(r.solutionPath).toContain(`/${promotedRef}.md`)
  })
})

describe("promoteCanaryFailure — --force semantics (GS-1.1 T6–T7)", () => {
  it("T6: --force bypasses DuplicateMatch refuse → writes new entry; dedupAction=user_forced", async () => {
    const fix = writeCanaryFixture({
      phase_output: "PROPAGATION FAILURE: npm registry returned 503",
    })
    seedExistingSolutionWithSameProblem(
      "PROPAGATION FAILURE: npm registry returned 503\n\n@sdsrs/sgc smoke_install",
    )
    const r = await promoteCanaryFailure({
      slug: fix.slug,
      stateRoot,
      force: true,
    })
    expect(r.dedupAction).toBe("user_forced")
    expect(existsSync(r.solutionPath)).toBe(true)
    // promoted_to: stamped even on forced write.
    const cf = parseFrontmatter<Record<string, unknown>>(
      readFileSync(fix.path, "utf8"),
    )
    expect(typeof cf.data["promoted_to"]).toBe("string")
  })

  it("T7: --force does NOT bypass AlreadyPromoted (orthogonal guard)", async () => {
    writeCanaryFixture({
      promoted_to: "build/some-earlier-canary-slug",
    })
    await expect(
      promoteCanaryFailure({
        slug: "2026-05-25-c29f021-smoke_install",
        stateRoot,
        force: true,
      }),
    ).rejects.toMatchObject({ code: "AlreadyPromoted" })
  })
})

describe("promoteCanaryFailure — phase-disambiguation slug (GS-1.1 T8 regression)", () => {
  it("T8: two canary records same SHA different phases → two distinct solution slugs both succeed", async () => {
    // GS-1 capture dedup key is (sha, phase) — two records can exist for
    // the same commit_sha at different failed_phase values. Promote
    // MUST preserve that distinction in the solution slug, else the
    // second promote silently overwrites the first.
    const fixSmoke = writeCanaryFixture({
      failed_phase: "smoke_install",
      phase_output: "SMOKE failure detail A",
      regression_seed: "Smoke-install safeguard: isolated npm install.",
    })
    const fixHealth = writeCanaryFixture({
      failed_phase: "health_url",
      health_url: "https://example.com/health",
      phase_output: "HEALTH failure detail B (503)",
      regression_seed:
        "Health-url safeguard: increase retry count for cold-start serverless.",
    })
    expect(fixSmoke.path).not.toBe(fixHealth.path) // distinct capture files

    const rSmoke = await promoteCanaryFailure({
      slug: fixSmoke.slug,
      stateRoot,
    })
    const rHealth = await promoteCanaryFailure({
      slug: fixHealth.slug,
      stateRoot,
    })

    // Two distinct solution paths (NO collision):
    expect(rSmoke.solutionPath).not.toBe(rHealth.solutionPath)
    expect(rSmoke.solutionPath).toContain("canary-c29f021-smoke_install")
    expect(rHealth.solutionPath).toContain("canary-c29f021-health_url")
    // Both on disk:
    expect(existsSync(rSmoke.solutionPath)).toBe(true)
    expect(existsSync(rHealth.solutionPath)).toBe(true)
    // Distinct prevention fields preserved:
    const solSmoke = parseFrontmatter<SolutionEntry>(
      readFileSync(rSmoke.solutionPath, "utf8"),
    )
    const solHealth = parseFrontmatter<SolutionEntry>(
      readFileSync(rHealth.solutionPath, "utf8"),
    )
    expect(solSmoke.data.prevention).toContain("Smoke-install safeguard")
    expect(solHealth.data.prevention).toContain("Health-url safeguard")
  })
})

describe("PromoteCanaryError shape (GS-1.1 T9)", () => {
  it("T9: is an Error subclass with readonly .code", async () => {
    try {
      await promoteCanaryFailure({ slug: "x", stateRoot })
      throw new Error("expected promoteCanaryFailure to reject")
    } catch (err) {
      expect(err).toBeInstanceOf(PromoteCanaryError)
      expect(err).toBeInstanceOf(Error)
      expect((err as PromoteCanaryError).code).toBe("MissingCanaryFailure")
    }
  })
})
