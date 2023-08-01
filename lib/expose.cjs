// https://stackoverflow.com/a/46745166/10109857

/**
 * returns renovates package.json
 * @type {import('./types').RenovatePackageJson}
 */
const pkg = (() => require('../package.json'))();

/**
 * return's prettier
 * @returns {typeof import('prettier')}
 */
function prettier() {
  return require('prettier');
}

module.exports = { pkg, prettier };
