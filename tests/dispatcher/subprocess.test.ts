import { test, expect } from "bun:test"
import { spawnCapture, whichSync } from "../../src/dispatcher/subprocess"

test("spawnCapture captures stdout + exitCode 0", async () => {
  const r = await spawnCapture(["node", "-e", "process.stdout.write('hi')"])
  expect(r.stdout).toBe("hi")
  expect(r.exitCode).toBe(0)
})

test("spawnCapture captures stderr + nonzero exit", async () => {
  const r = await spawnCapture(["node", "-e", "process.stderr.write('boom');process.exit(3)"])
  expect(r.stderr).toBe("boom")
  expect(r.exitCode).toBe(3)
})

test("spawnCapture on missing binary resolves exitCode -1 (no throw)", async () => {
  const r = await spawnCapture(["sgc-no-such-binary-xyz"])
  expect(r.exitCode).toBe(-1)
})

test("whichSync finds node, returns null for nonexistent", () => {
  expect(whichSync("node")).toBeTruthy()
  expect(whichSync("sgc-no-such-binary-xyz")).toBeNull()
})
