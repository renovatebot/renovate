const fs = require('fs-extra');
const os = require('os');
const is = require('@sindresorhus/is');
const path = require('path');
const { initLogger } = require('../../logger');
const configParser = require('../../config');
const repositoryWorker = require('../repository');
const cache = require('./cache');
const { appName } = require('../../config/app-strings');
const { autodiscoverRepositories } = require('./autodiscover');
const { setMeta } = require('./meta');

module.exports = {
  start,
  getRepositoryConfig,
};

async function start() {
  initLogger();
  try {
    cache.init(os.tmpdir());
    let config = await configParser.parseConfigs(process.env, process.argv);
    config = await setDirectories(config);
    setMeta(config);
    config = await autodiscoverRepositories(config);
    cache.init(config.cacheDir);
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
      const repoConfig = await getRepositoryConfig(config, repository);
      await repositoryWorker.renovateRepository(repoConfig);
    }
    logger.setMeta({});
    // istanbul ignore if
    if (global.renovateTimers) {
      global.renovateTimers.forEach(timer => clearTimeout(timer));
    }
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

async function setDirectories(input) {
  const config = { ...input };
  process.env.TMPDIR = process.env.RENOVATE_TMPDIR || os.tmpdir();
  if (config.baseDir) {
    logger.debug('Using configured baseDir: ' + config.baseDir);
  } else {
    config.baseDir = path.join(process.env.TMPDIR, 'renovate');
    logger.debug('Using baseDir: ' + config.baseDir);
  }
  await fs.ensureDir(config.baseDir);
  if (config.cacheDir) {
    logger.debug('Using configured cacheDir: ' + config.cacheDir);
  } else {
    config.cacheDir = path.join(config.baseDir, 'cache');
    logger.debug('Using cacheDir: ' + config.cacheDir);
  }
  await fs.ensureDir(config.cacheDir);
  return config;
}

async function getRepositoryConfig(globalConfig, repository) {
  const repoConfig = configParser.mergeChildConfig(
    globalConfig,
    is.string(repository) ? { repository } : repository
  );
  repoConfig.isBitbucket = repoConfig.platform === 'bitbucket';
  repoConfig.isBitbucketServer = repoConfig.platform === 'bitbucket-server';
  repoConfig.isGitHub = repoConfig.platform === 'github';
  repoConfig.isGitLab = repoConfig.platform === 'gitlab';
  repoConfig.isAzure = repoConfig.platform === 'azure';
  repoConfig.localDir = path.join(
    repoConfig.baseDir,
    `./repos/${repoConfig.platform}/${repoConfig.repository}`
  );
  await fs.ensureDir(repoConfig.localDir);
  delete repoConfig.baseDir;
  return configParser.filterConfig(repoConfig, 'repository');
}
