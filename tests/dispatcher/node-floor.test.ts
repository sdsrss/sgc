// v2.0.0 raised engines.node to >=22.19.0. The bundle still starts on older
// Node (measured: 18.20.8 and 20.20.2 run --version and doctor), so sgc warns
// rather than refusing. These pin the version comparison and the message.

import { describe, expect, test } from "bun:test"
import { engineFloor, nodeFloorNotice } from "../../src/node-floor"
import packageJson from "../../package.json"

describe("engineFloor", () => {
  test("parses a >=X.Y.Z range", () => {
    expect(engineFloor(">=22.19.0")).toEqual([22, 19, 0])
  })

  test("any other range shape → null (no guessing)", () => {
    expect(engineFloor("^22.19.0")).toBeNull()
    expect(engineFloor(">=22")).toBeNull()
    expect(engineFloor("")).toBeNull()
  })
})

describe("nodeFloorNotice", () => {
  test("below the floor → one line naming the found version, the floor, and the 1.x pin", () => {
    const msg = nodeFloorNotice("v20.20.2", ">=22.19.0")
    expect(msg).not.toBeNull()
    expect(msg).toContain("v20.20.2")
    expect(msg).toContain(">=22.19.0")
    // v2.0.1: the command ends the line, with nothing after it to copy by
    // accident: v2.0.0 put a comma right after it, and backticks would make
    // bash run npm's output as a command
    expect(msg!.endsWith(": npm i -g @sdsrs/sgc@1")).toBe(true)
    expect(msg).not.toContain("`")
    // v2.0.1: no plugin route back to 1.x. v1.38.5's hooks.json fails to load
    // in current Claude Code, so that route ended in a broken plugin
    expect(msg).not.toContain("/plugin")
    expect(msg).not.toContain("#v1.38.5")
    expect(msg).not.toContain("\n")
  })

  test("older patch of the floor's minor is still below", () => {
    expect(nodeFloorNotice("v22.18.9", ">=22.19.0")).not.toBeNull()
  })

  test("at or above the floor → null", () => {
    expect(nodeFloorNotice("v22.19.0", ">=22.19.0")).toBeNull()
    expect(nodeFloorNotice("v22.20.0", ">=22.19.0")).toBeNull()
    expect(nodeFloorNotice("v24.22.0", ">=22.19.0")).toBeNull()
    expect(nodeFloorNotice("26.8.1", ">=22.19.0")).toBeNull()
  })

  test("unparseable version or range → null (never warn on a guess)", () => {
    expect(nodeFloorNotice("not-a-version", ">=22.19.0")).toBeNull()
    expect(nodeFloorNotice("v20.0.0", "^22")).toBeNull()
  })

  test("the shipped engines range is one engineFloor can read", () => {
    expect(engineFloor(packageJson.engines.node)).not.toBeNull()
  })
})
