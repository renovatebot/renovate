const is = require('@sindresorhus/is');
const { getPlatformApi } = require('../../platform');
const hostRules = require('../../util/host-rules');

module.exports = {
  autodiscoverRepositories,
};

async function autodiscoverRepositories(config) {
  if (!config.autodiscover) {
    return config;
  }
  const credentials = hostRules.find(config, {});
  // Autodiscover list of repositories
  const discovered = await getPlatformApi(config.platform).getRepos(
    credentials.token,
    credentials.endpoint
  );
  if (!(discovered && discovered.length)) {
    // Soft fail (no error thrown) if no accessible repositories
    logger.info(
      'The account associated with your token does not have access to any repos'
    );
    return config;
  }
  logger.info(`Discovered ${discovered.length} repositories`);
  // istanbul ignore if
  if (config.repositories && config.repositories.length) {
    logger.debug(
      'Checking autodiscovered repositories against configured repositories'
    );
    for (const configuredRepo of config.repositories) {
      const repository = repoName(configuredRepo);
      let found = false;
      for (let i = discovered.length - 1; i > -1; i -= 1) {
        if (repository === repoName(discovered[i])) {
          found = true;
          logger.debug({ repository }, 'Using configured repository settings');
          discovered[i] = configuredRepo;
        }
      }
      if (!found) {
        logger.warn(
          { repository },
          'Configured repository is in not in autodiscover list'
        );
      }
    }
  }
  return { ...config, repositories: discovered };
}

// istanbul ignore next
function repoName(value) {
  return String(is.string(value) ? value : value.repository).toLowerCase();
}
