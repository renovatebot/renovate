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

module.exports = { dirname: __dirname, re2, pkg };
