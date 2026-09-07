import { isArray } from '@sindresorhus/is';
import JSON5 from 'json5';
import { MigrationsService } from '../../../../config/migrations/index.ts';
import { getEnvName } from '../../../../config/options/env.ts';
import { getOptions } from '../../../../config/options/index.ts';
import type { AllConfig } from '../../../../config/types.ts';
import { logger } from '../../../../logger/index.ts';
import { parseJson } from '../../../../util/common.ts';
import { coersions } from './coersions.ts';
import type { ParseConfigOptions } from './types.ts';
import { migrateAndValidateConfig, migrateGlobalConfig } from './util.ts';

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

// Environment variables are matched against option names, so a renamed option
// has to be resolved to its current name before the options loop below can find
// it. The mapping is taken from the migration service so it cannot drift;
// `azureAutoComplete`/`gitLabAutomerge` are added because
// `AzureGitLabAutomergeMigration` declares them via a regular expression.
const renameKeys: ReadonlyMap<string, string> = new Map([
  ...MigrationsService.renamedProperties,
  ['azureAutoComplete', 'platformAutomerge'],
  ['gitLabAutomerge', 'platformAutomerge'],
]);

function renameEnvKeys(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const result = { ...env };
  for (const [from, to] of renameKeys) {
    const fromKey = getEnvName({ name: from });
    const toKey = getEnvName({ name: to });
    if (env[fromKey]) {
      result[toKey] = env[fromKey];
      delete result[fromKey];
    }
  }
  return result;
}

// Options which migrate to a different name *and* a different value are absent
// from `getOptions()`, so they are read using these definitions and left under
// their old name for `migrateGlobalConfig()` to convert.
const deprecatedOptions: ParseConfigOptions[] = [
  { name: 'recreateClosed', type: 'boolean' },
];

interface ConvertedExperimentalEnvVar {
  optionName: string;
  // Normalize the raw env var value before passing it through, if needed.
  normalizeValue?: (value: string) => string;
}

// Maps RENOVATE_X_ env vars that have been promoted to regular config options
// to the option name they now correspond to.
export const convertedExperimentalEnvVars: ReadonlyMap<
  string,
  ConvertedExperimentalEnvVar
> = new Map([
  ['RENOVATE_X_AUTODISCOVER_REPO_SORT', { optionName: 'autodiscoverRepoSort' }],
  [
    'RENOVATE_X_AUTODISCOVER_REPO_ORDER',
    { optionName: 'autodiscoverRepoOrder' },
  ],
  ['RENOVATE_X_DOCKER_MAX_PAGES', { optionName: 'dockerMaxPages' }],
  ['RENOVATE_X_DELETE_CONFIG_FILE', { optionName: 'deleteConfigFile' }],
  ['RENOVATE_X_S3_ENDPOINT', { optionName: 's3Endpoint' }],
  ['RENOVATE_X_S3_PATH_STYLE', { optionName: 's3PathStyle' }],
  [
    'RENOVATE_X_MERGE_CONFIDENCE_API_BASE_URL',
    { optionName: 'mergeConfidenceEndpoint' },
  ],
  [
    'RENOVATE_X_MERGE_CONFIDENCE_SUPPORTED_DATASOURCES',
    { optionName: 'mergeConfidenceDatasources' },
  ],
  [
    'RENOVATE_X_REPO_CACHE_FORCE_LOCAL',
    {
      optionName: 'repositoryCacheForceLocal',
      // The old env var was treated as a flag: any non-empty value meant true.
      normalizeValue: (v: string) => (v ? 'true' : v),
    },
  ],
]);

/**
 * Massages the experimental env vars which have been converted to config options
 *
 * e.g. RENOVATE_X_AUTODISCOVER_REPO_SORT -> RENOVATE_AUTODISCOVER_REPO_SORT
 */
function massageConvertedExperimentalVars(
  env: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const result = { ...env };
  for (const [
    oldKey,
    { optionName, normalizeValue },
  ] of convertedExperimentalEnvVars) {
    if (env[oldKey] !== undefined) {
      const newKey = getEnvName({ name: optionName });
      result[newKey] = normalizeValue
        ? normalizeValue(env[oldKey])
        : env[oldKey];
      delete result[oldKey];
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

  const options: ParseConfigOptions[] = [...getOptions(), ...deprecatedOptions];
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
        if (isArray(parsed)) {
          // @ts-expect-error -- type can't be narrowed
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
      const coerce = coersions[option.type!];
      try {
        // @ts-expect-error -- type can't be narrowed
        config[option.name] = coerce(envVal);
      } catch (e) {
        throw new Error(`${envName} was invalid: ${e}`);
      }
    }
  }

  const githubComToken = env.GITHUB_COM_TOKEN ?? env.RENOVATE_GITHUB_COM_TOKEN;
  if (githubComToken) {
    logger.debug(`Converting GITHUB_COM_TOKEN into a global host rule`);
    config.hostRules.push({
      hostType: 'github',
      matchHost: 'github.com',
      token: githubComToken,
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

  return migrateGlobalConfig(config, 'env');
}

export function prepareEnv(inputEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = normalizePrefixes(inputEnv, inputEnv.ENV_PREFIX);
  return renameEnvKeys(massageConvertedExperimentalVars(env));
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
    logger.fatal(
      { err, configEnvKey },
      'Could not parse config environment variable',
    );
    process.exit(1);
  }
}
