// Removes build-machine paths from a bun bundle (see scripts/build-cli.mjs).
// Kept apart from the build script so it can be unit-tested without bun.
//
// bun bakes a CommonJS dependency's `__filename` / `__dirname` into the
// bundle as a string literal holding the absolute path it resolved (undici
// 7's index.js reads `__filename`). How the literal looks depends on the
// path: double quotes normally, single quotes when the path holds `"`, a
// template literal when it holds a newline, escapes for tabs and U+2028 and
// the like, backslashes on Windows; and the path need not lie inside the
// checkout (a symlinked node_modules resolves elsewhere). So the strip does
// not search for the checkout root as text: it finds each such literal,
// decodes it, and rewrites an absolute value to its part from the last
// `node_modules/`. Anything else in the bundle is left untouched.

import { runInNewContext } from "node:vm"

// A string literal as bun emits it: "…", '…', or `…` without substitutions.
const DQ = /"(?:[^"\\\n]|\\[\s\S])*"/.source
const SQ = /'(?:[^'\\\n]|\\[\s\S])*'/.source
const TL = /`(?:[^`\\$]|\\[\s\S]|\$(?!\{))*`/.source
// `(?<![\w$.])` keeps member assignments such as `obj.__filename = …` out.
const DECL = new RegExp(String.raw`(?<![\w$.])(__filename|__dirname)(\d*) = (${DQ}|${SQ}|${TL})`, "g")

/** Value of a literal matched by DECL (a single string literal, so evaluating it runs no code). */
function decode(literal) {
  return runInNewContext(literal)
}

function isAbsolute(p) {
  return /^(?:\/|[A-Za-z]:[\\/]|\\\\)/.test(p)
}

/**
 * @param {string} bundle bundle source
 * @returns {string} the bundle with every baked absolute `__filename` /
 *   `__dirname` rewritten to a `node_modules/…` relative path
 * @throws when a baked absolute path does not lie under a node_modules directory
 */
export function stripBuildPaths(bundle) {
  return bundle.replace(DECL, (whole, name, n, literal) => {
    const value = decode(literal)
    if (!isAbsolute(value)) return whole
    const p = value.replace(/\\/g, "/")
    const i = p.lastIndexOf("/node_modules/")
    if (i === -1) {
      throw new Error(`build-cli: bun baked an absolute path outside node_modules into the bundle: ${value}`)
    }
    return `${name}${n} = ${JSON.stringify(p.slice(i + 1))}`
  })
}

/**
 * @param {string} bundle bundle source
 * @returns {string[]} decoded values of every baked `__filename` / `__dirname`
 */
export function bakedPaths(bundle) {
  return [...bundle.matchAll(DECL)].map((m) => decode(m[3]))
}
