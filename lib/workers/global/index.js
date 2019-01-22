const is = require('@sindresorhus/is');
const { initLogger } = require('../../logger');
const configParser = require('../../config');
const repositoryWorker = require('../repository');
const cache = require('./cache');
const { appName } = require('../../config/app-strings');
const { autodiscoverRepositories } = require('./autodiscover');

module.exports = {
  start,
  getRepositoryConfig,
};

async function start() {
  initLogger();
  cache.init();
  try {
    let config = await configParser.parseConfigs(process.env, process.argv);
    config = await autodiscoverRepositories(config);
    if (config.repositories.length === 0) {
      logger.warn(
        'No repositories found - did you want to run with flag --autodiscover?'
      );
    }
    // istanbul ignore if
    if (
      config.platform === 'github' &&
      config.endpoint &&
      !config.customPrFooter
    ) {
      config.prFooter =
        'Available now for Enterprise: [Renovate Pro](https://renovatebot.com/pro) with real-time webhook handling and priority job queue.';
    }
    // istanbul ignore if
    if (
      config.platform === 'gitlab' &&
      config.endpoint &&
      !config.endpoint.startsWith('https://gitlab.com/') &&
      !config.customPrFooter
    ) {
      config.prFooter =
        'Available now for GitLab: [Renovate Pro](https://renovatebot.com/pro) with real-time webhook handling and priority job queue.';
    }
    // Move global variables that we need to use later
    const importGlobals = ['prBanner', 'prFooter'];
    config.global = {};
    importGlobals.forEach(key => {
      config.global[key] = config[key];
      delete config[key];
    });
    global.trustLevel = config.trustLevel || 'low';
    delete config.trustLevel;
    detectRenovateVersion();
    // Iterate through repositories sequentially
    for (const repository of config.repositories) {
      const repoConfig = getRepositoryConfig(config, repository);
      await repositoryWorker.renovateRepository(repoConfig);
    }
    logger.setMeta({});
    logger.info(`${appName} finished`);
  } catch (err) /* istanbul ignore next */ {
    logger.fatal({ err }, `Fatal error: ${err.message}`);
  }
}

// istanbul ignore next
function detectRenovateVersion() {
  try {
    global.renovateVersion = require('../../../package.json').version; // eslint-disable-line global-require
  } catch (err) {
    logger.debug({ err }, 'Error getting renovate version');
  }
}

function getRepositoryConfig(globalConfig, repository) {
  const repoConfig = configParser.mergeChildConfig(
    globalConfig,
    is.string(repository) ? { repository } : repository
  );
  repoConfig.isBitbucket = repoConfig.platform === 'bitbucket';
  repoConfig.isGitHub = repoConfig.platform === 'github';
  repoConfig.isGitLab = repoConfig.platform === 'gitlab';
  repoConfig.isAzure = repoConfig.platform === 'azure';
  return configParser.filterConfig(repoConfig, 'repository');
}
