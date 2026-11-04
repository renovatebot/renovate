import { isUndefined } from '@sindresorhus/is';
import { GlobalConfig } from '../../config/global.ts';
import type { UrlReplacement } from '../../config/types.ts';
import { coerceArray } from '../array.ts';
import { getEnv } from '../env.ts';
import { regEx } from '../regex.ts';
import { isHttpUrlPrefix, parseUrl } from '../url.ts';

export const basicEnvVars = [
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
  'HOME',
  'PATH',
  'LC_ALL',
  'LANG',
  'DOCKER_HOST',
  'DOCKER_TLS_VERIFY',
  'DOCKER_CERT_PATH',
  // Custom certificate variables
  // https://github.com/containerbase/base/blob/main/docs/custom-root-ca.md
  'SSL_CERT_DIR',
  'SSL_CERT_FILE',
  'NODE_EXTRA_CA_CERTS',
  'GIT_SSL_CAPATH',
  'GIT_SSL_CAINFO',
  // Required for NuGet to work on Windows.
  'PROGRAMFILES',
  'PROGRAMFILES(X86)',
  'APPDATA',
  'LOCALAPPDATA',
  // Required for .NET dotnet-install.ps1 to work on Windows.
  'PROCESSOR_ARCHITECTURE',
  'PATHEXT',
  // Corepack: https://github.com/nodejs/corepack
  'COREPACK_DEFAULT_TO_LATEST',
  'COREPACK_ENABLE_NETWORK',
  'COREPACK_ENABLE_STRICT',
  'COREPACK_ENABLE_PROJECT_SPEC',
  'COREPACK_ENABLE_UNSAFE_CUSTOM_URLS',
  'COREPACK_HOME',
  'COREPACK_INTEGRITY_KEYS',
  'COREPACK_NPM_REGISTRY',
  'COREPACK_NPM_TOKEN',
  'COREPACK_NPM_USERNAME',
  'COREPACK_NPM_PASSWORD',
  'COREPACK_ROOT',
  // pnpm specific variables
  'PNPM_WORKERS',
  'PNPM_MAX_WORKERS',
] as const;

export const hardcodedProcessEnv: Readonly<NodeJS.ProcessEnv> = {
  CI: 'true',
} as const;

const urlReplaceRegex = regEx(/^URL_REPLACE_\d+_(?:FROM|TO)$/);

// existing `URL_REPLACE_<n>_*` indexes from this one up don't move the start of the numbering, but are still skipped
const maxUrlReplaceIndex = 1_000_000;

/**
 * Returns whether `rule` replaces a whole host for every host type.
 */
function isHostReplacement(rule: UrlReplacement): boolean {
  return (
    isUndefined(rule.matchHostTypes) &&
    isHttpUrlPrefix(rule.matchUrlPrefix) &&
    isHttpUrlPrefix(rule.replaceUrlPrefix) &&
    parseUrl(rule.matchUrlPrefix)!.pathname === '/'
  );
}

/**
 * Returns the global `urlReplacements` which replace a whole host as containerbase `URL_REPLACE_<n>_FROM` and `URL_REPLACE_<n>_TO` variables, numbered after those in `process.env`, `customEnvVariables` and the repository's `env`.
 */
function getUrlReplacementEnv(): NodeJS.ProcessEnv {
  const existingKeys = new Set(
    Object.keys(getEnv()).filter((key) => urlReplaceRegex.test(key)),
  );
  const existingIndexes = [...existingKeys]
    .map((key) => parseInt(key.slice('URL_REPLACE_'.length), 10))
    .filter(
      (index) => Number.isSafeInteger(index) && index < maxUrlReplaceIndex,
    );
  let index = Math.max(0, ...existingIndexes);

  const env: NodeJS.ProcessEnv = {};
  for (const rule of coerceArray(GlobalConfig.get('urlReplacements')).filter(
    isHostReplacement,
  )) {
    // skip any number an existing variable uses, whatever its size
    do {
      index += 1;
    } while (
      existingKeys.has(`URL_REPLACE_${index}_FROM`) ||
      existingKeys.has(`URL_REPLACE_${index}_TO`)
    );
    env[`URL_REPLACE_${index}_FROM`] = rule.matchUrlPrefix;
    env[`URL_REPLACE_${index}_TO`] = rule.replaceUrlPrefix;
  }
  return env;
}

export function getChildProcessEnv(
  customEnvVars: string[] = [],
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  if (GlobalConfig.get('exposeAllEnv')) {
    return {
      ...process.env,
      ...getUrlReplacementEnv(),
      ...hardcodedProcessEnv,
    };
  }
  const envVars = [...basicEnvVars, ...customEnvVars];
  envVars.forEach((envVar) => {
    if (!isUndefined(process.env[envVar])) {
      env[envVar] = process.env[envVar];
    }
  });

  // Copy containerbase url replacements
  for (const key of Object.keys(process.env)) {
    if (urlReplaceRegex.test(key)) {
      env[key] = process.env[key];
    }
  }
  Object.assign(env, getUrlReplacementEnv());

  for (const [key, value] of Object.entries(hardcodedProcessEnv)) {
    env[key] = value;
  }

  return env;
}
