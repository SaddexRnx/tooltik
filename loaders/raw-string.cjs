/**
 * Minimal webpack-style raw loader for Turbopack (`turbopack.rules`):
 * turns `import src from "./file.js?raw"` into a module whose default
 * export is the file content as a string. Used for the SHA-256 worker
 * source so the browser gets the exact authored text.
 */
module.exports = function rawStringLoader(source) {
  return `module.exports = ${JSON.stringify(String(source))};`;
};
