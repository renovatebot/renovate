import is from '@sindresorhus/is';
import minimatch from 'minimatch';
import type { AllConfig } from '../../config/types';
import { logger } from '../../logger';
import { platform } from '../../modules/platform';
import { configRegexPredicate, isConfigRegex } from '../../util/regex';

// istanbul ignore next
function repoName(value: string | { repository: string }): string {
  return String(is.string(value) ? value : value.repository).toLowerCase();
}

export async function autodiscoverRepositories(
  config: AllConfig
): Promise<AllConfig> {
  if (!config.autodiscover) {
    if (!config.repositories?.length) {
      logger.warn(
        'No repositories found - did you want to run with flag --autodiscover?'
      );
    }
    return config;
  }
  // Autodiscover list of repositories
  let discovered = await platform.getRepos();
  if (!discovered?.length) {
    // Soft fail (no error thrown) if no accessible repositories
    logger.debug(
      'The account associated with your token does not have access to any repos'
    );
    return config;
  }
  if (config.autodiscoverFilter) {
    if (isConfigRegex(config.autodiscoverFilter)) {
      const autodiscoveryPred = configRegexPredicate(config.autodiscoverFilter);
      if (!autodiscoveryPred) {
        throw new Error(
          `Failed to parse regex pattern "${config.autodiscoverFilter}"`
        );
      }
      discovered = discovered.filter(autodiscoveryPred);
    } else {
      discovered = discovered.filter(
        minimatch.filter(config.autodiscoverFilter)
      );
    }
    if (!discovered.length) {
      // Soft fail (no error thrown) if no accessible repositories match the filter
      logger.debug('None of the discovered repositories matched the filter');
      return config;
    }
  }
  logger.info(
    { length: discovered.length, repositories: discovered },
    `Autodiscovered repositories`
  );
  // istanbul ignore if
  if (config.repositories?.length) {
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
          // TODO: fix typings
          discovered[i] = configuredRepo as never;
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
