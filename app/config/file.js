const logger = require('winston');

let configFile = process.env.RENOVATE_CONFIG_FILE || 'config';
if (!isPathAbsolute(configFile)) {
  configFile = `../../${configFile}`;
}

let config = {};
try {
  // eslint-disable-next-line global-require,import/no-dynamic-require
  config = require(configFile);
} catch (err) {
  // Do nothing
  logger.verbose('Could not locate config file');
}

logger.debug(`File config = ${JSON.stringify(config)}`);

module.exports = config;

function isPathAbsolute(path) {
  return /^(?:\/|[a-z]+:\/\/)/.test(path);
}
