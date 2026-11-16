import {
  type UrlPrefixResult,
  type UrlPrefixRule,
  replaceUrlPrefix,
} from '@renovatebot/base-image';
import { isNonEmptyString } from '@sindresorhus/is';
import { GlobalConfig } from '../../config/global.ts';
import type { UrlReplacement } from '../../config/types.ts';
import { logger } from '../../logger/index.ts';
import type { HostRule } from '../../types/index.ts';
import { coerceObject } from '../object.ts';
import { ensureTrailingSlash, parseUrl } from '../url.ts';
import {
  getUrlReplacements,
  hostRuleHasCredentials,
} from '../url-replacements.ts';
import { credentialHeaders } from './host-guard.ts';
import { type HostRulesGotOptions, findMatchingRule } from './host-rules.ts';

// the Docker registry token flow cannot be decided per request, use `registryAliases` instead
const excludedHostTypes: readonly (string | undefined)[] = ['docker'];

/**
 * Returns whether `rule` applies to requests with `hostType`.
 */
function matchesHostType(
  { matchHostTypes }: UrlReplacement,
  hostType: string | undefined,
): boolean {
  if (!matchHostTypes) {
    return true;
  }
  return hostType !== undefined && matchHostTypes.includes(hostType);
}

interface ActiveUrlReplacements {
  urlReplacements: UrlReplacement[];
  rules: UrlReplacement[];
}

let activeUrlReplacements: ActiveUrlReplacements | undefined;

/**
 * Returns the usable global `urlReplacements`, computed again only when `urlReplacements` changes.
 */
function getActiveUrlReplacements(): UrlReplacement[] {
  const urlReplacements = GlobalConfig.get('urlReplacements');
  if (activeUrlReplacements?.urlReplacements !== urlReplacements) {
    activeUrlReplacements = {
      urlReplacements,
      rules: getUrlReplacements(urlReplacements),
    };
  }
  return activeUrlReplacements.rules;
}

/**
 * Applies the global `urlReplacements` rules for `hostType` to `url`.
 */
function replaceUrl(
  url: string,
  hostType: string | undefined,
): UrlPrefixResult<UrlReplacement & UrlPrefixRule> {
  const rules = getActiveUrlReplacements()
    .filter((rule) => matchesHostType(rule, hostType))
    .map((rule) => ({
      ...rule,
      from: rule.matchUrlPrefix,
      to: rule.replaceUrlPrefix,
    }));
  return replaceUrlPrefix(url, rules);
}

function hasCredentialHeader(headers: object | undefined): boolean {
  return Object.entries(coerceObject(headers)).some(
    ([name, value]) =>
      credentialHeaders.includes(name.toLowerCase()) && isNonEmptyString(value),
  );
}

/**
 * Returns whether the request options carry credentials.
 */
function optionsHaveCredentials(options: HostRulesGotOptions): boolean {
  return (
    [options.token, options.username, options.password].some(
      isNonEmptyString,
    ) || hasCredentialHeader(options.headers)
  );
}

/**
 * Returns whether the host rule has credentials, or a certificate authority.
 */
function hostRuleHasCredentialsOrCa(hostRule: HostRule): boolean {
  return (
    hostRuleHasCredentials(hostRule) ||
    isNonEmptyString(hostRule.httpsCertificateAuthority)
  );
}

/**
 * Returns the URL to request instead of `url` according to the global `urlReplacements`, or `url` itself when no rule applies, the host type is excluded, or the original host is disabled or has credentials.
 */
export function applyUrlReplacements(
  url: URL,
  options: HostRulesGotOptions,
): URL {
  if (excludedHostTypes.includes(options.hostType)) {
    return url;
  }

  const originalUrl = url.toString();
  const { url: replacedUrl, applied } = replaceUrl(
    originalUrl,
    options.hostType,
  );
  if (!applied.length) {
    return url;
  }

  const hostRule = findMatchingRule(originalUrl, options);
  if (hostRule.enabled === false) {
    logger.once.debug(
      `urlReplacements: not replacing ${originalUrl}, the host is disabled`,
    );
    return url;
  }

  // a certificate authority alone is not authentication, but such hosts stay on their own connection settings
  if (optionsHaveCredentials(options) || hostRuleHasCredentialsOrCa(hostRule)) {
    logger.once.debug(
      `urlReplacements: not replacing ${originalUrl}, the request has credentials`,
    );
    return url;
  }

  const appliedRules = applied
    .map((rule) => `${rule.matchUrlPrefix} -> ${rule.replaceUrlPrefix}`)
    .join(', ');
  logger.once.debug(`urlReplacements: replacing ${appliedRules}`);
  return parseUrl(replacedUrl)!;
}

/**
 * Returns whether the global `urlReplacements` send a request with `hostType` to `url` to a mirror whose host rule has credentials.
 */
function isRewrittenToMirrorWithCredentials(
  url: string,
  hostType: string,
): boolean {
  const parsedUrl = parseUrl(url)!;
  const fetchUrl = applyUrlReplacements(parsedUrl, { hostType });
  return (
    fetchUrl !== parsedUrl &&
    hostRuleHasCredentials(findMatchingRule(fetchUrl.toString(), { hostType }))
  );
}

/**
 * Returns whether the global `urlReplacements` can send a request with `hostType` to `url`, or to a URL under it, to a mirror whose host rule has credentials.
 */
export function mayUseMirrorWithCredentials(
  url: string | undefined,
  hostType: string,
): boolean {
  const href = parseUrl(url)?.href;
  if (!href) {
    return false;
  }
  const prefix = ensureTrailingSlash(href);
  // a rule for a path under `url` only applies to the requests under that path
  const nestedPrefixes = getActiveUrlReplacements()
    .map(({ matchUrlPrefix }) => matchUrlPrefix)
    .filter((matchUrlPrefix) => matchUrlPrefix.startsWith(prefix));
  return [prefix, ...nestedPrefixes].some((requestUrl) =>
    isRewrittenToMirrorWithCredentials(requestUrl, hostType),
  );
}
