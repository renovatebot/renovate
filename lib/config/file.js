const logger = require('winston');

module.exports = {
  getConfig,
  isPathAbsolute,
};

function getConfig(env) {
  let configFile = env.RENOVATE_CONFIG_FILE || 'config';
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
  return config;
}

function isPathAbsolute(path) {
  return /^(?:\/|[a-z]+:\/\/)/.test(path);
}
