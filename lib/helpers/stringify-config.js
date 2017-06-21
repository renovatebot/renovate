const stringify = require('json-stringify-pretty-compact');

function stringifyConfig(conf) {
  const config = Object.assign({}, conf);
  delete config.api;
  delete config.logger;
  return stringify(config);
}

module.exports = stringifyConfig;
