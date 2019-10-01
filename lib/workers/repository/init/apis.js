const npmApi = require('../../../datasource/npm');
const { platform } = require('../../../platform');

async function getPlatformConfig(config) {
  const platformConfig = await platform.initRepo(config);
  return {
    ...config,
    ...platformConfig,
  };
}

async function initApis(input) {
  let config = { ...input };
  config = await getPlatformConfig(config);
  npmApi.resetMemCache();
  npmApi.setNpmrc(config.npmrc);
  delete config.gitPrivateKey;
  return config;
}

module.exports = {
  initApis,
};
