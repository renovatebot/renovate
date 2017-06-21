const stringify = require('json-stringify-pretty-compact');
const traverse = require('traverse');

function stringifyConfig(config) {
  // eslint-disable-next-line no-unused-vars,array-callback-return
  const scrubbed = traverse(config).map(function scrub(x) {
    if (this.key === 'logger' || this.key === 'api') {
      this.remove();
    }
  });
  return stringify(scrubbed);
}

module.exports = stringifyConfig;
