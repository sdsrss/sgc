import { test, expect } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runWork } from "../../src/commands/work"
import {
  ensureSgcStructure,
  writeCurrentTask,
  writeFeatureList,
} from "../../src/dispatcher/state"

test("printList shows file + step counts for decomposed tasks", async () => {
  const root = mkdtempSync(join(tmpdir(), "sgc-work-deep-"))
  ensureSgcStructure(root)
  writeCurrentTask({ task_id: "T1", level: "L2", active_feature: "f1", session_start: "x", last_activity: "x" }, "", root)
  writeFeatureList(
    {
      features: [
        {
          id: "f1",
          title: "add pagination",
          status: "pending",
          files: { create: ["a.ts"], modify: ["b.ts"], test: ["c.test.ts"] },
          steps: [{ kind: "test", text: "t" }, { kind: "commit", text: "c" }],
        },
      ],
    },
    "",
    root,
  )
  const lines: string[] = []
  await runWork({ stateRoot: root, log: (m) => lines.push(m) })
  const joined = lines.join("\n")
  expect(joined).toContain("f1: add pagination")
  expect(joined).toMatch(/3 files?/)
  expect(joined).toMatch(/2 steps?/)
})

test("nextActiveId skips a feature whose depends_on is unmet", async () => {
  const root = mkdtempSync(join(tmpdir(), "sgc-work-dep-"))
  ensureSgcStructure(root)
  writeCurrentTask({ task_id: "T2", level: "L2", active_feature: "f1", session_start: "x", last_activity: "x" }, "", root)
  writeFeatureList(
    {
      features: [
        { id: "f1", title: "first", status: "pending" },
        { id: "f2", title: "second", status: "pending", depends_on: ["f1"] },
      ],
    },
    "",
    root,
  )
  const lines: string[] = []
  await runWork({ stateRoot: root, log: (m) => lines.push(m) })
  expect(lines.join("\n")).toContain("[>] f1")
})
