import { test, expect } from "bun:test"
import { bundleParityCheck } from "../../src/commands/doctor"

test("bundleParityCheck skips cleanly when source absent", async () => {
  const r = await bundleParityCheck("/nonexistent-root-xyz")
  expect(r.severity).toBe("ok")
  expect(r.msg).toMatch(/skipped/i)
})
