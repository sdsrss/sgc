// Shared fixture: a completed `compound.related` spawn on disk.
//
// Invariant §3's write gate (P2-6) verifies a dedup stamp's provenance — the
// cited spawn must be a real compound.related spawn that left a result in the
// same state root. Tests that seed `solutions/` directly (rather than driving
// runCompound) therefore have to leave the same evidence a real run would.
//
// That is the point, not a tax: a fixture whose stamp cites a spawn that never
// ran was asserting against a corpus state the production code cannot produce.

import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { resultPath } from "../../src/dispatcher/spawn-protocol"
import type { DedupStamp } from "../../src/dispatcher/types"

export const FIXTURE_RELATED_SPAWN_ID = "01TESTSTAMP0000000000-compound.related"

/**
 * Write the result file a completed compound.related spawn leaves behind, so a
 * dedup stamp citing `spawnId` passes the §3 provenance check.
 * Returns the spawn id for use in a stamp.
 */
export function seedRelatedSpawn(
  stateRoot: string,
  spawnId: string = FIXTURE_RELATED_SPAWN_ID,
): string {
  const p = resultPath(spawnId, stateRoot)
  mkdirSync(resolve(p, ".."), { recursive: true })
  writeFileSync(
    p,
    "---\nbest_similarity: 0\nverdict: new_entry\nmatched_slug: null\n---\n",
    "utf8",
  )
  return spawnId
}

/** Seed the spawn and return a stamp that cites it. */
export function seededStamp(
  stateRoot: string,
  reason: DedupStamp["reason"] = "new_entry",
  spawnId: string = FIXTURE_RELATED_SPAWN_ID,
): DedupStamp {
  seedRelatedSpawn(stateRoot, spawnId)
  return {
    compound_related_spawn_id: spawnId,
    threshold_met_or_forced: true,
    reason,
  }
}
