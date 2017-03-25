const logger = require('winston');
const path = require('path');

module.exports = {
  getConfig,
};

function getConfig(env) {
  let configFile = env.RENOVATE_CONFIG_FILE || 'config';
  if (!path.isAbsolute(configFile)) {
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
  return config;
}
