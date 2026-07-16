// C9 · ARCH-2 — dispatcher/ is the lower layer and must not import commands/.
//
// dispatcher/loop.ts used to lazy-import ../commands/{plan,review,qa,compound}
// to assemble default step runners, inverting the dependency (a lower layer
// reaching up into a higher one). The production wiring belongs in
// commands/loop.ts and is injected via opts.steps. This test guards the
// invariant structurally (the roadmap's optional lint/doctor guard).

import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

function walkTs(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) out.push(...walkTs(p))
    else if (p.endsWith(".ts")) out.push(p)
  }
  return out
}

describe("C9/ARCH-2: layering", () => {
  test("no src/dispatcher/**/*.ts imports src/commands/ (static or dynamic)", () => {
    const dispatcherDir = join(import.meta.dir, "..", "..", "src", "dispatcher")
    // matches:  from "../commands/…"  and  import("../../commands/…")
    const commandsImport = /(?:from|import\()\s*["']\.\.\/(?:\.\.\/)?commands\//
    const offenders = walkTs(dispatcherDir).filter((f) =>
      commandsImport.test(readFileSync(f, "utf8")),
    )
    expect(offenders).toEqual([])
  })
})
