import is from '@sindresorhus/is';

import { getOptions, RenovateOptions } from './definitions';
import { RenovateConfig } from './common';
import { logger } from '../logger';

export function getEnvName(option: Partial<RenovateOptions>): string {
  if (option.env === false) {
    return '';
  }
  if (option.env) {
    return option.env;
  }
  const nameWithUnderscores = option.name.replace(/([A-Z])/g, '_$1');
  return `RENOVATE_${nameWithUnderscores.toUpperCase()}`;
}

export function getConfig(env: NodeJS.ProcessEnv): RenovateConfig {
  const options = getOptions();

  const config: RenovateConfig = { hostRules: [] };

  const coersions = {
    boolean: (val: string): boolean => val === 'true',
    array: (val: string): string[] => val.split(',').map(el => el.trim()),
    string: (val: string): string => val.replace(/\\n/g, '\n'),
    object: (val: string): any => JSON.parse(val),
    integer: parseInt,
  };

  options.forEach(option => {
    if (option.env !== false) {
      const envName = getEnvName(option);
      if (env[envName]) {
        // istanbul ignore if
        if (option.type === 'array' && option.subType === 'object') {
          try {
            const parsed = JSON.parse(env[envName]);
            if (is.array(parsed)) {
              config[option.name] = parsed;
            } else {
              logger.debug(
                { val: env[envName], envName },
                'Could not parse object array'
              );
            }
          } catch (err) {
            logger.debug({ val: env[envName], envName }, 'Could not parse CLI');
          }
        } else {
          const coerce = coersions[option.type];
          config[option.name] = coerce(env[envName]);
        }
      }
    }
  });

  if (env.GITHUB_COM_TOKEN) {
    config.hostRules.push({
      hostType: 'github',
      domainName: 'github.com',
      token: env.GITHUB_COM_TOKEN,
    });
  }

  if (env.DOCKER_USERNAME && env.DOCKER_PASSWORD) {
    config.hostRules.push({
      hostType: 'docker',
      username: env.DOCKER_USERNAME,
      password: env.DOCKER_PASSWORD,
    });
  }

  // These env vars are deprecated and deleted to make sure they're not used
  const unsupportedEnv = [
    'BITBUCKET_TOKEN',
    'BITBUCKET_USERNAME',
    'BITBUCKET_PASSWORD',
    'GITHUB_ENDPOINT',
    'GITHUB_TOKEN',
    'GITLAB_ENDPOINT',
    'GITLAB_TOKEN',
    'VSTS_ENDPOINT',
    'VSTS_TOKEN',
  ];
  // eslint-disable-next-line no-param-reassign
  unsupportedEnv.forEach(val => delete env[val]);

  return config;
}
