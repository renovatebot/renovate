const { initPlatform } = require('../../../platform');
const npmApi = require('../../../datasource/npm');

function assignPlatform(config) {
  logger.debug('assignPlatform');
  initPlatform(config.platform);
  return config;
}

async function getPlatformConfig(config) {
  const platformConfig = await platform.initRepo(config);
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
  npmApi.setNpmrc(
    config.npmrc,
    config.global ? config.global.exposeEnv : false
  );
  return config;
}

module.exports = {
  initApis,
};
