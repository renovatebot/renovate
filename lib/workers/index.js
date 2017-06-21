const logger = require('../helpers/logger');
const configParser = require('../config');
const repositoryWorker = require('./repository');

module.exports = {
  start,
};

async function start() {
  // Parse config
  try {
    logger.info('Renovate starting');
    const config = await configParser.parseConfigs(process.env, process.argv);
    // Iterate through repositories sequentially
    for (let index = 0; index < config.repositories.length; index += 1) {
      const repoConfig = configParser.getRepoConfig(config, index);
      await repositoryWorker.processRepo(repoConfig, logger);
    }
    logger.info('Renovate finished');
  } catch (error) {
    logger.error(error.message);
  }
}
