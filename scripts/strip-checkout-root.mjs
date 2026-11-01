// Removes the build checkout's absolute path from a bun bundle (see
// scripts/build-cli.mjs). Kept apart from the build script so it can be
// unit-tested without running bun.
//
// Only a string literal that starts with `<root>/node_modules/` is rewritten
// (that is the shape bun emits for a dependency's `__filename`). A bare
// `<root>/` match would also cut unrelated text when the root is short: with
// the checkout at /sgc, "https://github.com/sdsrss/sgc/issues" contains
// "/sgc/".

/**
 * @param {string} bundle bundle source
 * @param {string} root absolute path of the checkout the bundle was built in
 * @returns {string}
 */
export function stripCheckoutRoot(bundle, root) {
  const prefix = '"' + root.replace(/\\/g, "/") + "/node_modules/"
  return bundle.split(prefix).join('"node_modules/')
}
