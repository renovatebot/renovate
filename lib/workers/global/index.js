const logger = require('../../logger');
const configParser = require('../../config');
const repositoryWorker = require('../repository');
const versions = require('./versions');

module.exports = {
  start,
  getRepositoryConfig,
};

async function start() {
  try {
    const config = await configParser.parseConfigs(process.env, process.argv);
    config.logger = logger;
    config.versions = versions.detectVersions(config);
    // Iterate through repositories sequentially
    for (let index = 0; index < config.repositories.length; index += 1) {
      const repoConfig = module.exports.getRepositoryConfig(config, index);
      repoConfig.logger.info('Renovating repository');
      await repositoryWorker.renovateRepository(repoConfig, repoConfig.token);
      repoConfig.logger.info('Finished repository');
    }
    if (config.repositories.length === 0) {
      logger.warn(
        'No repositories found - did you want to run with flag --autodiscover?'
      );
    }
    logger.info('Renovate finished');
  } catch (err) {
    logger.fatal(`Renovate fatal error: ${err.message}`);
    logger.error(err);
  }
}

function getRepositoryConfig(globalConfig, index) {
  let repository = globalConfig.repositories[index];
  if (typeof repository === 'string') {
    repository = { repository };
  }
  const repoConfig = configParser.mergeChildConfig(globalConfig, repository);
  repoConfig.logger = logger.child({
    repository: repoConfig.repository,
  });
  repoConfig.isGitHub = repoConfig.platform === 'github';
  repoConfig.isGitLab = repoConfig.platform === 'gitlab';
  return configParser.filterConfig(repoConfig, 'repository');
}
