import is from '@sindresorhus/is';

import { PLATFORM_TYPE_GITHUB } from '../constants/platforms';
import * as datasourceDocker from '../datasource/docker';
import { logger } from '../logger';
import { getOptions } from './definitions';
import type { GlobalConfig, RenovateOptions } from './types';

// istanbul ignore if
if (process.env.ENV_PREFIX) {
  for (const [key, val] of Object.entries(process.env)) {
    if (key.startsWith(process.env.ENV_PREFIX)) {
      process.env[key.replace(process.env.ENV_PREFIX, 'RENOVATE_')] = val;
    }
  }
}

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

export function getConfig(env: NodeJS.ProcessEnv): GlobalConfig {
  const options = getOptions();

  let config: GlobalConfig = {};

  if (env.RENOVATE_CONFIG) {
    try {
      config = JSON.parse(env.RENOVATE_CONFIG);
      logger.debug({ config }, 'Detected config in env RENOVATE_CONFIG');
    } catch (err) /* istanbul ignore next */ {
      logger.fatal({ err }, 'Could not parse RENOVATE_CONFIG');
      process.exit(1);
    }
  }

  config.hostRules ||= [];

  const coersions = {
    boolean: (val: string): boolean => val === 'true',
    array: (val: string): string[] => val.split(',').map((el) => el.trim()),
    string: (val: string): string => val.replace(/\\n/g, '\n'),
    object: (val: string): any => JSON.parse(val),
    integer: parseInt,
  };

  options.forEach((option) => {
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
      hostType: PLATFORM_TYPE_GITHUB,
      domainName: 'github.com',
      token: env.GITHUB_COM_TOKEN,
    });
  }

  if (env.DOCKER_USERNAME && env.DOCKER_PASSWORD) {
    config.hostRules.push({
      hostType: datasourceDocker.id,
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
  unsupportedEnv.forEach((val) => delete env[val]);

  return config;
}
