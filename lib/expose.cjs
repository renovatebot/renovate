/* eslint-disable @typescript-eslint/no-require-imports */
// we need `require` for dynamic runtime imports
// https://stackoverflow.com/a/46745166/10109857

/**
 * returns renovates package.json
 */
const path = (() => require('path'))();
// need to use dynamic strings so that typescript does not include package.json in dist folder after compilation
const filePath = path.join(__dirname, '..', 'package.json');
const pkg = (() => require(filePath))();

/**
 * return's re2
 * @returns {RegExpConstructor}
 */
function re2() {
  return require('re2');
}

/**
 * return's prettier
 * @returns {typeof import('prettier')}
 */
function prettier() {
  return require('prettier');
}

/**
 * return's openpgp
 * @returns {typeof import('openpgp')}
 */
function openpgp() {
  return require('openpgp');
}

/**
 * return's sqlite
 * @returns {typeof import('better-sqlite3')}
 */
function sqlite() {
  return require('better-sqlite3');
}

module.exports = {
  re2,
  pkg,
  openpgp,
  prettier,
  sqlite,
};
