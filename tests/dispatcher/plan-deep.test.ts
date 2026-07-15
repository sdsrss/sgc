import { test, expect } from "bun:test"
import { mkdtempSync, readFileSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runPlan } from "../../src/commands/plan"
import {
  ensureSgcStructure,
  readFeatureList,
  writeSolution,
} from "../../src/dispatcher/state"
import type { DedupStamp, SolutionEntry } from "../../src/dispatcher/types"
import { seedRelatedSpawn } from "../fixtures/related-spawn"

const MOTIV = "we need cursor pagination on the orders endpoint because offset paging is slow at scale and clients time out on large pages"

test("L2 auto-decomposes into a feature with bite-sized steps", async () => {
  const root = mkdtempSync(join(tmpdir(), "sgc-plan-deep-"))
  process.env["SGC_FORCE_INLINE"] = "1"
  await runPlan("add cursor pagination to GET /orders", { stateRoot: root, forceLevel: "L2", motivation: MOTIV })
  const fl = readFeatureList(root)!
  const f = fl.list.features[0]!
  expect(f.steps).toBeDefined()
  expect(f.steps!.map((s) => s.kind)).toContain("verify-red")
  expect(f.files).toBeDefined()
})

test("L1 default keeps the single placeholder (no decomposition)", async () => {
  const root = mkdtempSync(join(tmpdir(), "sgc-plan-l1-"))
  process.env["SGC_FORCE_INLINE"] = "1"
  await runPlan("fix a typo in the readme heading text now", { stateRoot: root, forceLevel: "L1", motivation: MOTIV })
  const fl = readFeatureList(root)!
  expect(fl.list.features[0]!.steps).toBeUndefined()
})

test("L1 --deep decomposes", async () => {
  const root = mkdtempSync(join(tmpdir(), "sgc-plan-l1-deep-"))
  process.env["SGC_FORCE_INLINE"] = "1"
  // "extract" avoids L2 keywords (no refactor/API/auth); classifier returns L1.
  await runPlan("extract date formatting helpers into a shared util file", { stateRoot: root, forceLevel: "L1", motivation: MOTIV, deep: true })
  const fl = readFeatureList(root)!
  expect(fl.list.features[0]!.steps).toBeDefined()
})

test("deep plan writes a derived markdown doc", async () => {
  const root = mkdtempSync(join(tmpdir(), "sgc-plan-md-"))
  process.env["SGC_FORCE_INLINE"] = "1"
  await runPlan("add cursor pagination to GET /orders", { stateRoot: root, forceLevel: "L2", motivation: MOTIV })
  const dir = join(root, "docs", "superpowers", "plans")
  const files = readdirSync(dir)
  expect(files.length).toBe(1)
  expect(readFileSync(join(dir, files[0]!), "utf8")).toContain("Implementation Plan")
})

// Step 5 (acceptance #3): seed a prior solution whose text overlaps ≥3 of the
// 5 keywords in the intent ("add cursor pagination to GET /orders" → tokens:
// add, cursor, pagination, get, orders). Score = 5/5 = 1.0 > 0.5 surfacing
// floor → researcher.history surfaces it → decompose receives it in prior_art
// → feature carries prior_art_refs.
const STAMP: DedupStamp = {
  compound_related_spawn_id: "01DECOMPOSEPRIORARTSEED000-compound.related",
  threshold_met_or_forced: true,
  reason: "new_entry",
}

function makePaginationSolution(): SolutionEntry {
  return {
    id: "01HPAGINATIONSEED000000000000",
    signature: "a".repeat(64),
    category: "perf",
    problem:
      "cursor pagination on the GET /orders endpoint was missing; offset pagination timed out on large pages",
    symptoms: ["orders list timeout on large offset", "slow GET /orders with high offset"],
    what_didnt_work: [
      {
        approach: "offset pagination",
        reason_failed: "full table scan at high offsets",
      },
    ],
    solution:
      "Add a cursor field to GET /orders; use keyset pagination on the primary key to avoid full scans",
    prevention:
      "Always add a cursor-based pagination mode when adding paginated list endpoints",
    tags: ["pagination", "cursor", "orders", "perf"],
    first_seen: "2026-05-01T00:00:00Z",
    last_updated: "2026-05-01T00:00:00Z",
    times_referenced: 0,
    source_task_ids: ["01HORIGINPAGINATION000000000"],
  }
}

test("deep plan carries prior_art_refs when a matching solution is seeded", async () => {
  const root = mkdtempSync(join(tmpdir(), "sgc-plan-prior-"))
  ensureSgcStructure(root)
  process.env["SGC_FORCE_INLINE"] = "1"

  // Seed the solution so the corpus walker finds it. §3 (P2-6) requires the
  // stamp's compound.related spawn to exist on disk, as after a real run.
  seedRelatedSpawn(root, STAMP.compound_related_spawn_id)
  writeSolution(makePaginationSolution(), "cursor-pagination-orders", STAMP, "", root)

  await runPlan("add cursor pagination to GET /orders", {
    stateRoot: root,
    forceLevel: "L2",
    motivation: MOTIV,
  })

  const fl = readFeatureList(root)!
  const f = fl.list.features[0]!
  expect(f.prior_art_refs).toBeDefined()
  expect(f.prior_art_refs!.length).toBeGreaterThan(0)
})
