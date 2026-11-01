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
  // The plugin-bundled CLI wins over a global npm install (README), so the
  // npm pin alone does not move plugin users back; the plugin route re-adds
  // the marketplace at the last 1.x tag (Claude Code accepts `#<ref>` there).
  // Removing a marketplace uninstalls its plugins, so the route ends with a
  // reinstall.
  return (
    `[sgc] Node ${nodeVersion} is below sgc's supported range (node ${enginesNode}). ` +
    `It may still run, but this version is untested. ` +
    `Upgrade Node, or stay on sgc 1.x (Node >=18.17): npm i -g @sdsrs/sgc@1; ` +
    `plugin: /plugin marketplace remove sgc, then /plugin marketplace add sdsrss/sgc#v1.38.5, ` +
    `then /plugin install sgc@sgc`
  )
}
