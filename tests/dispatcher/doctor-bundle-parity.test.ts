import { test, expect } from "bun:test"
import { bundleParityCheck, bundleExecBitOk } from "../../src/commands/doctor"

test("bundleParityCheck skips cleanly when source absent", async () => {
  const r = await bundleParityCheck("/nonexistent-root-xyz")
  expect(r.severity).toBe("ok")
  expect(r.msg).toMatch(/skipped/i)
})

test("bundleExecBitOk: 100755 has exec bit", () => {
  expect(bundleExecBitOk("100755 abc123 0\tplugins/sgc/bin/sgc.mjs")).toBe(true)
})

test("bundleExecBitOk: 100644 lacks exec bit (the v1.24.0 drift)", () => {
  expect(bundleExecBitOk("100644 abc123 0\tplugins/sgc/bin/sgc.mjs")).toBe(false)
})

test("bundleExecBitOk: untracked / empty output is indeterminate (null → skip)", () => {
  expect(bundleExecBitOk("")).toBeNull()
  expect(bundleExecBitOk("   \n")).toBeNull()
})

test("bundleExecBitOk: malformed mode field is indeterminate (null → skip)", () => {
  expect(bundleExecBitOk("notamode abc 0\tpath")).toBeNull()
})
