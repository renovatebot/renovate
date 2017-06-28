const logger = require('../../helpers/logger');
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
      await repositoryWorker.renovateRepository(repoConfig);
      repoConfig.logger.info('Finished repository');
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
  const repoConfig = Object.assign({}, globalConfig, repository);
  repoConfig.logger = logger.child({
    repository: repoConfig.repository,
  });
  repoConfig.isGitHub = repoConfig.platform === 'github';
  repoConfig.isGitLab = repoConfig.platform === 'gitlab';
  return configParser.filterConfig(repoConfig, 'repository');
}
