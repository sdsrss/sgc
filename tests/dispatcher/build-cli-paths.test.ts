// v2.0.0: bun bakes a CommonJS dependency's `__filename` into the bundle as
// the build machine's absolute path (undici 7's index.js reads it to decorate
// fetch errors). The bundle then depended on where it was built: test.yml run
// 41341840174 rejected a bundle built under /home/ai/dev/sgc because CI's
// rebuild under /home/runner/work/sgc/sgc differed in that one string, so
// only a bundle carrying CI's checkout path could have passed the gate.

import { expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { stripCheckoutRoot } from "../../scripts/strip-checkout-root.mjs"

const ROOT = resolve(import.meta.dir, "../..")

test("stripping a short checkout root leaves unrelated strings alone", () => {
  // a checkout mounted at /sgc (e.g. `docker run -v "$PWD":/sgc`): "/sgc/"
  // also occurs inside the repo URL and the repo-relative plugin paths
  const bundle = [
    'url: "https://github.com/sdsrss/sgc/issues"',
    'const commandsDir = resolve(ctx.root, "plugins/sgc/commands")',
    'var __filename = "/sgc/node_modules/undici/index.js"',
  ].join("\n")
  expect(stripCheckoutRoot(bundle, "/sgc")).toBe(
    [
      'url: "https://github.com/sdsrss/sgc/issues"',
      'const commandsDir = resolve(ctx.root, "plugins/sgc/commands")',
      'var __filename = "node_modules/undici/index.js"',
    ].join("\n"),
  )
})

test("the built bundle contains no absolute path of the build checkout", () => {
  const dir = mkdtempSync(join(tmpdir(), "sgc-build-paths-"))
  try {
    const out = join(dir, "sgc.mjs")
    const r = spawnSync("node", [join(ROOT, "scripts/build-cli.mjs"), "--outfile", out], {
      cwd: ROOT,
      encoding: "utf8",
    })
    expect(r.status).toBe(0)
    const bundle = readFileSync(out, "utf8")
    expect(bundle.includes(ROOT + "/")).toBe(false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}, 120_000)
