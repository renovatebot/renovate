import is from '@sindresorhus/is';
import { getOptions } from '../../../../config/options';
import type { AllConfig, RenovateOptions } from '../../../../config/types';
import { PlatformId } from '../../../../constants';
import { logger } from '../../../../logger';

function normalizePrefixes(
  env: NodeJS.ProcessEnv,
  prefix: string | undefined
): NodeJS.ProcessEnv {
  const result = { ...env };
  if (prefix) {
    for (const [key, val] of Object.entries(result)) {
      if (key.startsWith(prefix)) {
        const newKey = key.replace(prefix, 'RENOVATE_');
        result[newKey] = val;
        delete result[key];
      }
    }
  }
  return result;
}

export function getEnvName(option: Partial<RenovateOptions>): string {
  if (option.env === false) {
    return '';
  }
  if (option.env) {
    return option.env;
  }
  const nameWithUnderscores = option.name?.replace(/([A-Z])/g, '_$1');
  return `RENOVATE_${nameWithUnderscores?.toUpperCase()}`;
}

const renameKeys = {
  azureAutoComplete: 'platformAutomerge', // migrate: azureAutoComplete
  gitLabAutomerge: 'platformAutomerge', // migrate: gitLabAutomerge
};

function renameEnvKeys(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const result = { ...env };
  for (const [from, to] of Object.entries(renameKeys)) {
    const fromKey = getEnvName({ name: from });
    const toKey = getEnvName({ name: to });
    if (env[fromKey]) {
      result[toKey] = env[fromKey];
      delete result[fromKey];
    }
  }
  return result;
}

export function getConfig(inputEnv: NodeJS.ProcessEnv): AllConfig {
  let env = inputEnv;
  env = normalizePrefixes(inputEnv, inputEnv.ENV_PREFIX);
  env = renameEnvKeys(env);

  const options = getOptions();

  let config: AllConfig = {};

  if (env.RENOVATE_CONFIG) {
    try {
      config = JSON.parse(env.RENOVATE_CONFIG);
      logger.debug({ config }, 'Detected config in env RENOVATE_CONFIG');
    } catch (err) {
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
        if (option.type === 'array' && option.subType === 'object') {
          try {
            const parsed = JSON.parse(env[envName] as string);
            if (is.array(parsed)) {
              config[option.name] = parsed;
            } else {
              logger.debug(
                { val: env[envName], envName },
                'Could not parse object array'
              );
            }
          } catch (err) {
            logger.debug(
              { val: env[envName], envName },
              'Could not parse environment variable'
            );
          }
        } else {
          const coerce = coersions[option.type];
          config[option.name] = coerce(env[envName] as string);
        }
      }
    }
  });

  if (env.GITHUB_COM_TOKEN) {
    logger.debug(`Converting GITHUB_COM_TOKEN into a global host rule`);
    config.hostRules.push({
      hostType: PlatformId.Github,
      matchHost: 'github.com',
      token: env.GITHUB_COM_TOKEN,
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

  unsupportedEnv.forEach((val) => delete env[val]);

  return config;
}
