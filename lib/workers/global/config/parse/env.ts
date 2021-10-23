import is from '@sindresorhus/is';

import { getOptions } from '../../../../config/options';
import type { AllConfig, RenovateOptions } from '../../../../config/types';
import { PlatformId } from '../../../../constants';
import { logger } from '../../../../logger';
import type { HostRule } from '../../../../types';
import { regEx } from '../../../../util/regex';
import { hostRulesFromEnv } from './host-rules-from-env';

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
  const nameWithUnderscores = option.name.replace(regEx(/([A-Z])/g), '_$1');
  return `RENOVATE_${nameWithUnderscores.toUpperCase()}`;
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
    string: (val: string): string => val.replace(regEx(/\\n/g), '\n'),
    object: (val: string): any => JSON.parse(val),
    integer: parseInt,
  };

  options.forEach((option) => {
    if (option.env !== false) {
      const envName = getEnvName(option);
      if (env[envName]) {
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
            logger.debug(
              { val: env[envName], envName },
              'Could not parse environment variable'
            );
          }
        } else {
          const coerce = coersions[option.type];
          config[option.name] = coerce(env[envName]);
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

  const datasources = new Set(getDatasourceList());
  const fields = ['token', 'username', 'password'];

  const hostRules: HostRule[] = [];

  const npmEnvPrefixes = ['npm_config_', 'npm_lifecycle_', 'npm_package_'];

  for (const envName of Object.keys(env).sort()) {
    if (npmEnvPrefixes.some((prefix) => envName.startsWith(prefix))) {
      logger.trace('Ignoring npm env: ' + envName);
      continue; // eslint-disable-line no-continue
    }
    // Double underscore __ is used in place of hyphen -
    const splitEnv = envName
      .toLowerCase()
      .replace(regEx(/__/g), '-')
      .split('_'); // TODO #12071
    const hostType = splitEnv.shift();
    if (datasources.has(hostType)) {
      const suffix = splitEnv.pop();
      if (fields.includes(suffix)) {
        let matchHost: string;
        const rule: HostRule = {};
        rule[suffix] = env[envName];
        if (splitEnv.length === 0) {
          // host-less rule
        } else if (splitEnv.length === 1) {
          logger.warn(`Cannot parse ${envName} env`);
          continue; // eslint-disable-line no-continue
        } else {
          matchHost = splitEnv.join('.');
        }
        const existingRule = hostRules.find(
          (hr) => hr.hostType === hostType && hr.matchHost === matchHost
        );
        logger.debug(`Converting ${envName} into a global host rule`);
        if (existingRule) {
          // Add current field to existing rule
          existingRule[suffix] = env[envName];
        } else {
          // Create a new rule
          const newRule: HostRule = {
            hostType,
          };
          if (matchHost) {
            newRule.matchHost = matchHost;
          }
          newRule[suffix] = env[envName];
          hostRules.push(newRule);
        }
      }
    }
  }
  config.hostRules = [...config.hostRules, ...hostRulesFromEnv(env)];

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
