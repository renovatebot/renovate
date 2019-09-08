import is from '@sindresorhus/is';
import { platform } from '../../platform';

const minimatch = require('minimatch');
const { logger } = require('../../logger');

export { autodiscoverRepositories };

async function autodiscoverRepositories(config) {
  if (!config.autodiscover) {
    return config;
  }
  // Autodiscover list of repositories
  let discovered = await platform.getRepos();
  if (!(discovered && discovered.length)) {
    // Soft fail (no error thrown) if no accessible repositories
    logger.info(
      'The account associated with your token does not have access to any repos'
    );
    return config;
  }
  if (config.autodiscoverFilter) {
    discovered = discovered.filter(minimatch.filter(config.autodiscoverFilter));
    if (!discovered.length) {
      // Soft fail (no error thrown) if no accessible repositories match the filter
      logger.info('None of the discovered repositories matched the filter');
      return config;
    }
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
