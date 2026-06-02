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
//   3. chmod 0o755
//
// Usage: node scripts/build-cli.mjs [--outfile <path>]
//   --outfile defaults to plugins/sgc/bin/sgc.mjs

import { spawnSync } from "node:child_process"
import { chmodSync, readFileSync, writeFileSync } from "node:fs"

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
  writeFileSync(outfile, SHEBANG + s)
} else {
  writeFileSync(outfile, s.replace(/^#![^\n]*\n/, SHEBANG))
}
chmodSync(outfile, 0o755)
