import is from '@sindresorhus/is';

import { PLATFORM_TYPE_GITHUB } from '../constants/platforms';
import { getDatasourceList } from '../datasource';
import { logger } from '../logger';
import { HostRule } from '../types';
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

  const datasources = new Set(getDatasourceList());
  const fields = ['token', 'username', 'password'];

  const hostRules: HostRule[] = [];

  for (const envName of Object.keys(env).sort()) {
    // Double underscore __ is used in place of hyphen -
    const splitEnv = envName.toLowerCase().replace('__', '-').split('_');
    const hostType = splitEnv.shift();
    if (datasources.has(hostType)) {
      const suffix = splitEnv.pop();
      if (fields.includes(suffix)) {
        let hostName: string;
        let domainName: string;
        const rule: HostRule = {};
        rule[suffix] = env[envName];
        if (splitEnv.length === 0) {
          // host-less rule
        } else if (splitEnv.length === 1) {
          logger.warn(`Cannot parse ${envName} env`);
        } else if (splitEnv.length === 2) {
          domainName = splitEnv.join('.');
        } else {
          hostName = splitEnv.join('.');
        }
        const existingRule = hostRules.find(
          (hr) =>
            hr.hostType === hostType &&
            hr.hostName === hostName &&
            hr.domainName === domainName
        );
        if (existingRule) {
          // Add current field to existing rule
          existingRule[suffix] = env[envName];
        } else {
          // Create a new rule
          const newRule: HostRule = {
            hostType,
          };
          if (hostName) {
            newRule.hostName = hostName;
          } else if (domainName) {
            newRule.domainName = domainName;
          }
          newRule[suffix] = env[envName];
          hostRules.push(newRule);
        }
      }
    }
  }

  config.hostRules = [...config.hostRules, ...hostRules];

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
