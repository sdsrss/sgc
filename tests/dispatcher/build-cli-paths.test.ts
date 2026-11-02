// v2.0.0: bun bakes a CommonJS dependency's `__filename` into the bundle as
// the build machine's absolute path (undici 7's index.js reads it to decorate
// fetch errors). The bundle then depended on where it was built: test.yml run
// 41341840174 rejected a bundle built under /home/ai/dev/sgc because CI's
// rebuild under /home/runner/work/sgc/sgc differed in that one string, so
// only a bundle carrying CI's checkout path could have passed the gate.
//
// v2.0.1: the strip no longer matches the checkout root as text. It decodes
// each `__filename` / `__dirname` literal bun emitted, whatever quoting or
// escaping bun chose, and rewrites the value from its last `node_modules/`.

import { expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { bakedPaths, stripBuildPaths } from "../../scripts/strip-checkout-root.mjs"

const ROOT = resolve(import.meta.dir, "../..")

const U = 'node_modules/undici/index.js'

// How bun 1.3.5 serialises the path for checkouts at various locations
// (observed by building under bwrap mounts at those paths).
const cases: Array<[string, string]> = [
  ["plain", 'var __filename = "/home/u/sgc/node_modules/undici/index.js", Client'],
  ["checkout at /", 'var __filename = "/node_modules/undici/index.js", Client'],
  ["short root /sgc", 'var __filename = "/sgc/node_modules/undici/index.js", Client'],
  ["double quote in path", "var __filename = '/q/a\"b/sgc/node_modules/undici/index.js', Client"],
  ["tab in path", 'var __filename = "/q/a\\tb/sgc/node_modules/undici/index.js", Client'],
  ["newline in path", "var __filename = `/q/a\nb/sgc/node_modules/undici/index.js`, Client"],
  ["U+2028 in path", 'var __filename = "/q/a\\u2028b/sgc/node_modules/undici/index.js", Client'],
  ["node_modules symlinked outside", 'var __filename = "/cache/node_modules/undici/index.js", Client'],
  ["checkout inside node_modules", 'var __filename = "/x/node_modules/sgc/node_modules/undici/index.js", Client'],
  ["Windows", 'var __filename = "C:\\\\Users\\\\u\\\\sgc\\\\node_modules\\\\undici\\\\index.js", Client'],
  ["__dirname", 'var __dirname = "/home/u/sgc/node_modules/undici", Client'],
]

for (const [name, line] of cases) {
  test(`baked path rewritten to a node_modules-relative literal: ${name}`, () => {
    const out = stripBuildPaths(line)
    const want = name === "__dirname" ? 'var __dirname = "node_modules/undici", Client' : `var __filename = "${U}", Client`
    expect(out).toBe(want)
  })
}

test("unrelated strings are left alone, even when they contain the checkout root", () => {
  // a checkout mounted at /sgc: "/sgc/" also occurs inside the repo URL and
  // the repo-relative plugin paths
  const rest = [
    'url: "https://github.com/sdsrss/sgc/issues"',
    'const commandsDir = resolve(ctx.root, "plugins/sgc/commands")',
    'obj.__filename = "/sgc/x.js"',
  ].join("\n")
  const bundle = `${rest}\nvar __filename = "/sgc/node_modules/undici/index.js", Client`
  expect(stripBuildPaths(bundle)).toBe(`${rest}\nvar __filename = "${U}", Client`)
})

test("an already relative baked path is left as is", () => {
  const line = `var __filename = "${U}", Client`
  expect(stripBuildPaths(line)).toBe(line)
})

test("an absolute baked path outside node_modules fails the build", () => {
  expect(() => stripBuildPaths('var __filename = "/home/u/sgc/src/x.cjs";')).toThrow(/outside node_modules/)
})

test("the built bundle carries no absolute baked path and no checkout path", () => {
  const dir = mkdtempSync(join(tmpdir(), "sgc-build-paths-"))
  try {
    const out = join(dir, "sgc.mjs")
    const r = spawnSync("node", [join(ROOT, "scripts/build-cli.mjs"), "--outfile", out], {
      cwd: ROOT,
      encoding: "utf8",
    })
    expect(r.status).toBe(0)
    const bundle = readFileSync(out, "utf8")
    const baked = bakedPaths(bundle)
    expect(baked.length).toBeGreaterThan(0)
    for (const p of baked) expect(p.startsWith("node_modules/")).toBe(true)
    expect(bundle.includes(ROOT + "/")).toBe(false)
    expect(bundle.includes(JSON.stringify(ROOT + "/").slice(1, -1))).toBe(false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}, 120_000)
