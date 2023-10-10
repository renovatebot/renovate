// https://stackoverflow.com/a/46745166/10109857

/**
 * returns renovates package.json
 * @type {import('./types').RenovatePackageJson}
 */
const pkg = (() => require('../package.json'))();

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

module.exports = { re2, pkg, prettier };
