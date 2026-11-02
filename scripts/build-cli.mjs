#!/usr/bin/env node
// Single source of truth for the node ESM bundle build.
//
// Both `npm run build:cli` (package.json) and the `bundleParityCheck` in
// src/commands/doctor.ts invoke this script, so the bun-build flags live in
// exactly ONE place. If anyone changes the flags here, the parity check
// rebuilds with the same flags — no silent false-STALE failures.
//
// Behavior (unchanged from the previous inlined build:cli one-liner):
//   1. bun build src/sgc.ts --target=node --format=esm --external playwright
//      --outfile <outfile>
//   2. normalize the shebang to `#!/usr/bin/env node` (prepend if absent,
//      else replace line 1)
//   3. strip build-machine paths bun baked in (see below)
//   4. chmod 0o755
//
// Usage: node scripts/build-cli.mjs [--outfile <path>]
//   --outfile defaults to plugins/sgc/bin/sgc.mjs

import { spawnSync } from "node:child_process"
import { chmodSync, readFileSync, writeFileSync } from "node:fs"
import { stripBuildPaths } from "./strip-checkout-root.mjs"

function parseOutfile(argv) {
  const i = argv.indexOf("--outfile")
  if (i !== -1 && argv[i + 1]) return argv[i + 1]
  return "plugins/sgc/bin/sgc.mjs"
}

const outfile = parseOutfile(process.argv.slice(2))

const r = spawnSync(
  "bun",
  ["build", "src/sgc.ts", "--target=node", "--format=esm", "--external", "playwright", "--outfile", outfile],
  { stdio: "inherit" },
)
if (r.status !== 0) {
  process.exit(r.status ?? 1)
}

// Normalize the shebang to `#!/usr/bin/env node` (prepend if absent, else
// replace the first line) and make the bundle executable.
const SHEBANG = "#!/usr/bin/env node\n"
let s = readFileSync(outfile, "utf8")
if (!s.startsWith("#!")) {
  s = SHEBANG + s
} else {
  s = s.replace(/^#![^\n]*\n/, SHEBANG)
}
// bun bakes a CommonJS dependency's `__filename` into the bundle as an
// absolute path (undici 7's index.js reads it to decorate fetch errors). That
// made the bundle depend on where it was built: CI's parity gate, building
// under /home/runner/work/sgc/sgc, rejected a bundle built anywhere else, so
// the only bundle that could pass it carried CI's checkout path. The value is
// rewritten to its node_modules-relative part (strip-checkout-root.mjs says
// how, and why not by matching the checkout root as text). undici uses
// the value in one place: it skips appending its own stack frames to a fetch
// error whose stack already contains the string. No stack frame of the
// single-file bundle contains either form; the shorter relative string can
// only change that for an error whose message itself contains
// "node_modules/undici/index.js" (and sgc prints err.stack only under
// SGC_DEBUG).
s = stripBuildPaths(s)
writeFileSync(outfile, s)
chmodSync(outfile, 0o755)
