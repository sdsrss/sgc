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
    expect(msg).toContain("@sdsrs/sgc@1")
    // the plugin-bundled CLI wins over a global npm install, so the plugin
    // channel needs its own way back
    expect(msg).toContain("sdsrss/sgc#v1.38.5")
    // removing a marketplace uninstalls its plugins, so the way back must end
    // with a reinstall, in this order
    const remove = msg!.indexOf("/plugin marketplace remove sgc")
    const add = msg!.indexOf("/plugin marketplace add sdsrss/sgc#v1.38.5")
    const install = msg!.indexOf("/plugin install sgc@sgc")
    expect(remove).toBeGreaterThan(-1)
    expect(add).toBeGreaterThan(remove)
    expect(install).toBeGreaterThan(add)
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
