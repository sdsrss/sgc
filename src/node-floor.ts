// v2.0.0 raised engines.node to the oldest Node LTS still maintained upstream
// (22; 18 and 20 are past end-of-life). The bundle still starts on older Node
// (measured: 18.20.8 and 20.20.2 run --version and doctor), so sgc warns once
// per process on stderr instead of refusing: users on the plugin channel never
// see npm's EBADENGINE warning, and this is how they learn they are off the
// supported floor.

type Version = [number, number, number]

/** Lowest version a ">=X.Y.Z" engines range admits; null for any other shape. */
export function engineFloor(range: string): Version | null {
  const m = /^>=(\d+)\.(\d+)\.(\d+)$/.exec(range.trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

function parseVersion(v: string): Version | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

function below(a: Version, b: Version): boolean {
  for (let i = 0; i < 3; i++) {
    if (a[i]! !== b[i]!) return a[i]! < b[i]!
  }
  return false
}

/** One-line warning when `nodeVersion` is below `enginesNode`; null otherwise or when either is unparseable. */
export function nodeFloorNotice(nodeVersion: string, enginesNode: string): string | null {
  const floor = engineFloor(enginesNode)
  const found = parseVersion(nodeVersion)
  if (!floor || !found || !below(found, floor)) return null
  // Only the npm channel has a way back to 1.x. v2.0.0 also offered plugin
  // users a marketplace pin to v1.38.5, but that version's hooks.json fails to
  // load in current Claude Code, so the route ended in a broken plugin; plugin
  // users upgrade Node. The npm command ends the line, so nothing after it
  // gets copied with it (v2.0.0 put a comma there; backticks would make bash
  // run npm's output as a command).
  return (
    `[sgc] Node ${nodeVersion} is below sgc's supported range (node ${enginesNode}). ` +
    `It may still run, but this version is untested. ` +
    `Upgrade Node, or, for the npm install, stay on sgc 1.x (Node >=18.17) with: npm i -g @sdsrs/sgc@1`
  )
}
