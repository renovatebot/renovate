const logger = require('../helpers/logger');
const configParser = require('../config');
const repositoryWorker = require('./repository');

module.exports = {
  start,
  getRepositoryConfig,
};

async function start() {
  logger.info('Renovate starting');
  try {
    const config = await configParser.parseConfigs(process.env, process.argv);
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
  return configParser.filterConfig(repoConfig, 'repository');
}
