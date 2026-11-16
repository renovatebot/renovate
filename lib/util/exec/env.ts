import { isNonEmptyString, isUndefined } from '@sindresorhus/is';
import { GlobalConfig } from '../../config/global.ts';
import type { UrlReplacement } from '../../config/types.ts';
import { logger } from '../../logger/index.ts';
import type { HostRule } from '../../types/index.ts';
import { getEnv } from '../env.ts';
import * as hostRules from '../host-rules.ts';
import { regEx } from '../regex.ts';
import { parseUrl } from '../url.ts';
import {
  getUrlReplacements,
  hostRuleHasCredentials,
} from '../url-replacements.ts';

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

// existing `URL_REPLACE_<n>_*` indexes from this one up do not move the start of the numbering, but are still skipped
const maxUrlReplaceIndex = 1_000_000;

/**
 * Returns whether `rule` applies to every host type.
 */
function isExportableRule(rule: UrlReplacement): boolean {
  return isUndefined(rule.matchHostTypes);
}

/**
 * Returns whether `matchHost` is a URL under `url`.
 */
function isUrlUnder(matchHost: string, url: string): boolean {
  return parseUrl(matchHost)?.href.startsWith(url) ?? false;
}

/**
 * Returns whether `rule` can apply to requests to `url`: it has no `matchHost`, its `matchHost` matches `url`, or it is a URL under `url`.
 */
function mayMatchUrl({ matchHost }: Readonly<HostRule>, url: string): boolean {
  return (
    !isNonEmptyString(matchHost) ||
    hostRules.matchesHost(url, matchHost) ||
    isUrlUnder(matchHost, url)
  );
}

/**
 * Returns whether `rule` has credentials, a client certificate or key, or a certificate authority, which child processes do not get.
 */
function hasCredentials(rule: Readonly<HostRule>): boolean {
  return (
    hostRuleHasCredentials(rule) ||
    [rule.username, rule.httpsCertificateAuthority].some(isNonEmptyString)
  );
}

/**
 * Returns whether a host rule which can apply to requests to `url` has credentials or a certificate authority, including the credentials detached from registry URLs.
 */
function hasHostRuleCredentials(url: string): boolean {
  return hostRules.someRule(
    (rule) => mayMatchUrl(rule, url) && hasCredentials(rule),
  );
}

/**
 * Returns whether `rule` can be passed to containerbase, which only supports anonymous access to the replacement host with the default TLS settings.
 */
function isAnonymousRule(rule: UrlReplacement): boolean {
  if (hasHostRuleCredentials(rule.replaceUrlPrefix)) {
    logger.once.debug(
      `urlReplacements: not passing ${rule.matchUrlPrefix} to child processes, ${rule.replaceUrlPrefix} has credentials or a certificate authority`,
    );
    return false;
  }
  return true;
}

interface ExportableRules {
  urlReplacements: UrlReplacement[];
  hostRulesRevision: number;
  rules: UrlReplacement[];
}

let exportableRules: ExportableRules | undefined;

/**
 * Returns the global `urlReplacements` without `matchHostTypes` and without credentials for the replacement URL, computed again only when `urlReplacements` or the host rules change.
 */
function getExportableRules(): UrlReplacement[] {
  const urlReplacements = GlobalConfig.get('urlReplacements');
  const hostRulesRevision = hostRules.getRevision();
  if (
    exportableRules?.urlReplacements !== urlReplacements ||
    exportableRules.hostRulesRevision !== hostRulesRevision
  ) {
    const activeRules = getUrlReplacements(urlReplacements);
    const passedRules = activeRules
      .filter(isExportableRule)
      .filter(isAnonymousRule);
    exportableRules = {
      urlReplacements,
      hostRulesRevision,
      rules: passedRules.filter(
        (rule) => !isShadowedByUnpassedRule(rule, activeRules, passedRules),
      ),
    };
  }
  return exportableRules.rules;
}

/**
 * Returns whether a rule of `activeRules` before `rule`, which wins over it for the URLs within its `matchUrlPrefix`, is not in `passedRules`, and logs that once.
 */
function isShadowedByUnpassedRule(
  rule: UrlReplacement,
  activeRules: UrlReplacement[],
  passedRules: UrlReplacement[],
): boolean {
  const shadowingRule = activeRules
    .slice(0, activeRules.indexOf(rule))
    .find(
      (other) =>
        other.matchUrlPrefix.startsWith(rule.matchUrlPrefix) &&
        !passedRules.includes(other),
    );
  if (!shadowingRule) {
    return false;
  }
  logger.once.debug(
    `urlReplacements: not passing ${rule.matchUrlPrefix} to child processes, ${shadowingRule.matchUrlPrefix} is not passed`,
  );
  return true;
}

/**
 * Returns the global `urlReplacements` without `matchHostTypes` and without credentials for the replacement URL as containerbase `URL_REPLACE_<n>_FROM` and `URL_REPLACE_<n>_TO` variables, numbered after those in `process.env`, `customEnvVariables` and the repository's `env`.
 */
function getUrlReplacementEnv(): NodeJS.ProcessEnv {
  const rules = getExportableRules();
  if (!rules.length) {
    return {};
  }

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
  for (const rule of rules) {
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
