const platform = require('../../../platform');
const { detectSemanticCommits } = require('./semantic');

function assignPlatform(config) {
  const { logger } = config;
  logger.debug('assignPlatform');
  platform.init(config.platform);
  return config;
}

async function getPlatformConfig(config) {
  const platformConfig = await platform.initRepo(
    config.repository,
    config.token,
    config.endpoint,
    config.logger
  );
  return {
    ...config,
    ...platformConfig,
  };
}

async function initApis(input, token) {
  let config = { ...input, token };
  config = await assignPlatform(config);
  config = await getPlatformConfig(config);
  config = await detectSemanticCommits(config);
  return config;
}

module.exports = {
  initApis,
};
