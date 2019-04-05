const Git = require('simple-git/promise');
const { initPlatform } = require('../../../platform');
const npmApi = require('../../../datasource/npm');

function assignPlatform(config) {
  logger.trace('assignPlatform');
  initPlatform(config.platform);
  return config;
}

async function setGitPrivateKey(config) {
  if (config.gitPrivateKey && config.localDir) {
    try {
      const cwd = config.localDir;
      const git = Git(cwd).silent(true);
      await git.raw(['config', 'user.signingkey', config.gitPrivateKey]);
    } catch (err) {
      logger.warn({ err }, 'Error in setting git private key to author');
    }
  }
}

async function getPlatformConfig(config) {
  const platformConfig = await platform.initRepo(config);
  return {
    ...config,
    ...platformConfig,
  };
}

async function initApis(input) {
  let config = { ...input };
  await setGitPrivateKey(config);
  config = await assignPlatform(config);
  config = await getPlatformConfig(config);
  npmApi.resetMemCache();
  npmApi.setNpmrc(config.npmrc);
  delete config.gitPrivateKey;
  return config;
}

module.exports = {
  initApis,
};
