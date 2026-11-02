// Types for strip-checkout-root.mjs (a plain-JS module, since build-cli.mjs
// runs under node; tests import it from TypeScript).
export function stripBuildPaths(bundle: string): string
export function bakedPaths(bundle: string): string[]
