const logger = require('../helpers/logger');
const configParser = require('../config');
const repositoryWorker = require('./repository');

module.exports = {
  start,
};

async function start() {
  logger.info('Renovate starting');
  try {
    const config = await configParser.parseConfigs(process.env, process.argv);
    // Iterate through repositories sequentially
    for (let index = 0; index < config.repositories.length; index += 1) {
      const repoConfig = configParser.getRepoConfig(config, index);
      repoConfig.logger = logger.child({ repository: repoConfig.repository });
      repoConfig.logger.info('Renovating repository');
      await repositoryWorker.processRepo(repoConfig);
      repoConfig.logger.info('Finished repository');
    }
    logger.info('Renovate finished');
  } catch (err) {
    logger.fatal(`Renovate fatal error: ${err.message}`);
    logger.error(err);
  }
}
