import is from '@sindresorhus/is';
import JSON5 from 'json5';
import { getOptions } from '../../../../config/options';
import type { AllConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { parseJson } from '../../../../util/common';
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
  mergeConfidenceApiBaseUrl: 'mergeConfidenceEndpoint',
  mergeConfidenceSupportedDatasources: 'mergeConfidenceDatasources',
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

// these experimental env vars have been converted into self-hosted config options
const convertedExperimentalEnvVars = [
  'RENOVATE_X_AUTODISCOVER_REPO_SORT',
  'RENOVATE_X_AUTODISCOVER_REPO_ORDER',
  'RENOVATE_X_DOCKER_MAX_PAGES',
  'RENOVATE_X_DELETE_CONFIG_FILE',
  'RENOVATE_X_S3_ENDPOINT',
  'RENOVATE_X_S3_PATH_STYLE',
  'RENOVATE_X_MERGE_CONFIDENCE_API_BASE_URL',
  'RENOVATE_X_MERGE_CONFIDENCE_SUPPORTED_DATASOURCES',
];

/**
 * Massages the experimental env vars which have been converted to config options
 *
 * e.g. RENOVATE_X_AUTODISCOVER_REPO_SORT -> RENOVATE_AUTODISCOVER_REPO_SORT
 */
function massageConvertedExperimentalVars(
  env: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const result = { ...env };
  for (const key of convertedExperimentalEnvVars) {
    if (env[key] !== undefined) {
      const newKey = key.replace('RENOVATE_X_', 'RENOVATE_');
      result[newKey] = env[key];
      delete result[key];
    }
  }
  return result;
}

export async function getConfig(
  inputEnv: NodeJS.ProcessEnv,
  configEnvKey = 'RENOVATE_CONFIG',
): Promise<AllConfig> {
  const env = prepareEnv(inputEnv);
  const config = await parseAndValidateOrExit(env, configEnvKey);

  const options = getOptions();
  config.hostRules ??= [];

  for (const option of options) {
    if (option.env === false) {
      continue;
    }

    const envName = getEnvName(option);
    const envVal = env[envName];
    if (!envVal) {
      continue;
    }

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
      } catch {
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
          logger.warn('env config dryRun property has been changed to full');
          config[option.name] = 'full';
        } else if ((config[option.name] as string) === 'false') {
          logger.warn('env config dryRun property has been changed to null');
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

      if (option.name === 'platformCommit') {
        if ((config[option.name] as string) === 'true') {
          logger.warn(
            'env config platformCommit property has been changed to enabled',
          );
          config[option.name] = 'enabled';
        } else if ((config[option.name] as string) === 'false') {
          logger.warn(
            'env config platformCommit property has been changed to disabled',
          );
          config[option.name] = 'disabled';
        }
      }
    }
  }

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

  for (const val of unsupportedEnv) {
    delete env[val];
  }

  return config;
}

export function prepareEnv(inputEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  let env = normalizePrefixes(inputEnv, inputEnv.ENV_PREFIX);
  env = massageConvertedExperimentalVars(env);
  env = renameEnvKeys(env);
  // massage the values of migrated configuration keys
  return massageEnvKeyValues(env);
}

export async function parseAndValidateOrExit(
  env: NodeJS.ProcessEnv,
  configEnvKey: string,
): Promise<AllConfig> {
  if (!env[configEnvKey]) {
    return {};
  }

  try {
    const config = parseJson(
      env[configEnvKey],
      `${configEnvKey}.env.json5`,
    ) as AllConfig;
    logger.debug({ config }, `Detected config in env ${configEnvKey}`);

    return await migrateAndValidateConfig(config, `${configEnvKey}`);
  } catch (err) {
    logger.fatal({ err }, `Could not parse ${configEnvKey}`);
    process.exit(1);
  }
}
