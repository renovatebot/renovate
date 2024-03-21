import is from '@sindresorhus/is';
import JSON5 from 'json5';
import { getOptions } from '../../../../config/options';
import type { AllConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { coersions } from './coersions';
import type { ParseConfigOptions } from './types';
import { migrateAndValidateConfig } from './util';

function normalizePrefixes(
  env: NodeJS.ProcessEnv,
  prefix: string | undefined,
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

export function getEnvName(option: ParseConfigOptions): string {
  if (option.env === false) {
    return '';
  }
  if (option.env) {
    return option.env;
  }
  const nameWithUnderscores = option.name.replace(/([A-Z])/g, '_$1');
  return `RENOVATE_${nameWithUnderscores.toUpperCase()}`;
}

const renameKeys = {
  aliases: 'registryAliases',
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

const migratedKeysWithValues = [
  {
    oldName: 'recreateClosed',
    newName: 'recreateWhen',
    from: 'true',
    to: 'always',
  },
  {
    oldName: 'recreateClosed',
    newName: 'recreateWhen',
    from: 'false',
    to: 'auto',
  },
];

function massageEnvKeyValues(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const result = { ...env };
  for (const { oldName, newName, from, to } of migratedKeysWithValues) {
    const key = getEnvName({ name: oldName });
    if (env[key] !== undefined) {
      if (result[key] === from) {
        delete result[key];
        result[getEnvName({ name: newName })] = to;
      }
    }
  }
  return result;
}

export async function getConfig(
  inputEnv: NodeJS.ProcessEnv,
): Promise<AllConfig> {
  let env = inputEnv;
  env = normalizePrefixes(inputEnv, inputEnv.ENV_PREFIX);
  env = renameEnvKeys(env);
  // massage the values of migrated configuration keys
  env = massageEnvKeyValues(env);

  const options = getOptions();

  let config: AllConfig = {};

  if (env.RENOVATE_CONFIG) {
    try {
      config = JSON5.parse(env.RENOVATE_CONFIG);
      logger.debug({ config }, 'Detected config in env RENOVATE_CONFIG');

      config = await migrateAndValidateConfig(config, 'RENOVATE_CONFIG');
    } catch (err) {
      logger.fatal({ err }, 'Could not parse RENOVATE_CONFIG');
      process.exit(1);
    }
  }

  config.hostRules ||= [];

  options.forEach((option) => {
    if (option.env !== false) {
      const envName = getEnvName(option);
      const envVal = env[envName];
      if (envVal) {
        if (option.type === 'array' && option.subType === 'object') {
          try {
            const parsed = JSON5.parse(envVal);
            if (is.array(parsed)) {
              config[option.name] = parsed;
            } else {
              logger.debug(
                { val: envVal, envName },
                'Could not parse object array',
              );
            }
          } catch (err) {
            logger.debug(
              { val: envVal, envName },
              'Could not parse environment variable',
            );
          }
        } else {
          const coerce = coersions[option.type];
          config[option.name] = coerce(envVal);
          if (option.name === 'dryRun') {
            if ((config[option.name] as string) === 'true') {
              logger.warn(
                'env config dryRun property has been changed to full',
              );
              config[option.name] = 'full';
            } else if ((config[option.name] as string) === 'false') {
              logger.warn(
                'env config dryRun property has been changed to null',
              );
              delete config[option.name];
            } else if ((config[option.name] as string) === 'null') {
              delete config[option.name];
            }
          }
          if (option.name === 'requireConfig') {
            if ((config[option.name] as string) === 'true') {
              logger.warn(
                'env config requireConfig property has been changed to required',
              );
              config[option.name] = 'required';
            } else if ((config[option.name] as string) === 'false') {
              logger.warn(
                'env config requireConfig property has been changed to optional',
              );
              config[option.name] = 'optional';
            }
          }
        }
      }
    }
  });

  if (env.GITHUB_COM_TOKEN) {
    logger.debug(`Converting GITHUB_COM_TOKEN into a global host rule`);
    config.hostRules.push({
      hostType: 'github',
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
