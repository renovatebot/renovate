const logger = require('./logger');
const configParser = require('./config');
const repositoryWorker = require('./workers/repository');

module.exports = {
  start,
};

async function start() {
  // Parse config
  try {
    logger.info('Renovate starting');
    const config = await configParser.parseConfigs(process.env, process.argv);
    // Iterate through repositories sequentially
    for (const repository of config.repositories) {
      const repoConfig = getRepoConfig(config, repository);
      await repositoryWorker.processRepo(repoConfig, logger);
    }
    logger.info('Renovate finished');
  } catch (error) {
    logger.error(error.message);
  }
}

function getRepoConfig(config, repository) {
  let repoConfig;
  config.repositories.some(repo => {
    if (repo === repository) {
      repoConfig = { repository: repo };
    }
    if (repo.repository === repository) {
      repoConfig = repo;
    }
    return repoConfig;
  });
  const returnConfig = Object.assign({}, config, repoConfig);
  delete returnConfig.repositories;
  return returnConfig;
}
