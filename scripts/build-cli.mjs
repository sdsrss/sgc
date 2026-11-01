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
//   3. strip the build checkout's absolute path (see below)
//   4. chmod 0o755
//
// Usage: node scripts/build-cli.mjs [--outfile <path>]
//   --outfile defaults to plugins/sgc/bin/sgc.mjs

import { spawnSync } from "node:child_process"
import { chmodSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

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
// made the bundle depend on where it was built (CI's parity gate, building
// under /home/runner/work/sgc/sgc, rejected a bundle built elsewhere) and
// would ship the builder's home directory. Relative is behavior-neutral there:
// undici only checks whether a stack trace contains the path, and in a
// single-file bundle it never does either way.
s = s.split(ROOT.replace(/\\/g, "/") + "/").join("")
writeFileSync(outfile, s)
chmodSync(outfile, 0o755)
