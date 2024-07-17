// https://stackoverflow.com/a/46745166/10109857

/**
 * returns renovates package.json
 * @type {import('./types').RenovatePackageJson}
 */
// const pkg = (() => require('../package.json'))();

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
  // pkg,
  openpgp,
  prettier,
  sqlite,
};
