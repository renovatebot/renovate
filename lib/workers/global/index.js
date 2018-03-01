const { initLogger } = require('../../logger');
const configParser = require('../../config');
const repositoryWorker = require('../repository');
const configValidation = require('../../config/validation');

module.exports = {
  start,
  getRepositoryConfig,
};

async function start() {
  initLogger();
  try {
    const config = await configParser.parseConfigs(process.env, process.argv);
    const { warnings, errors } = configValidation.validateConfig(config);
    // istanbul ignore if
    if (warnings.length) {
      logger.warn({ warnings }, 'Found config warnings');
    }
    if (errors.length) {
      logger.error({ errors }, 'Found config errors');
    }
    if (config.repositories.length === 0) {
      logger.warn(
        'No repositories found - did you want to run with flag --autodiscover?'
      );
    }
    // Move global variables that we need to use later
    const importGlobals = ['exposeEnv', 'prBanner'];
    config.global = {};
    importGlobals.forEach(key => {
      config.global[key] = config[key];
      delete config[key];
    });
    // Iterate through repositories sequentially
    for (let index = 0; index < config.repositories.length; index += 1) {
      const repoConfig = module.exports.getRepositoryConfig(config, index);
      await repositoryWorker.renovateRepository(repoConfig, repoConfig.token);
    }
    logger.setMeta({});
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
  repoConfig.isGitHub = repoConfig.platform === 'github';
  repoConfig.isGitLab = repoConfig.platform === 'gitlab';
  repoConfig.isVsts = repoConfig.platform === 'vsts';
  return configParser.filterConfig(repoConfig, 'repository');
}
