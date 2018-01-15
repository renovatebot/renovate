const { initPlatform } = require('../../../platform');
const npmApi = require('../../../manager/npm/registry');

function assignPlatform(config) {
  logger.debug('assignPlatform');
  initPlatform(config.platform);
  return config;
}

async function getPlatformConfig(config) {
  const platformConfig = await platform.initRepo(
    config.repository,
    config.token,
    config.endpoint,
    config.forkMode,
    config.forkToken
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
  config.npmrc = config.npmrc || (await platform.getFile('.npmrc'));
  npmApi.resetMemCache();
  npmApi.setNpmrc(config.npmrc);
  return config;
}

module.exports = {
  initApis,
};
