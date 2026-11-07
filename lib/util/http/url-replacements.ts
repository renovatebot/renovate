import {
  type UrlPrefixResult,
  type UrlPrefixRule,
  replaceUrlPrefix,
} from '@renovatebot/base-image';
import {
  isArray,
  isNonEmptyObject,
  isNonEmptyString,
  isString,
  isUndefined,
} from '@sindresorhus/is';
import { GlobalConfig } from '../../config/global.ts';
import type { UrlReplacement } from '../../config/types.ts';
import { logger } from '../../logger/index.ts';
import type { HostRule } from '../../types/index.ts';
import { coerceArray } from '../array.ts';
import { coerceObject } from '../object.ts';
import { isHttpUrlPrefix, parseUrl } from '../url.ts';
import { credentialHeaders } from './host-guard.ts';
import { type HostRulesGotOptions, findMatchingRule } from './host-rules.ts';

// the Docker registry token flow can't be decided per request, use `registryAliases` instead
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

/**
 * Returns whether `matchHostTypes` of `rule` is unset or a list of strings.
 */
function hasValidMatchHostTypes({ matchHostTypes }: UrlReplacement): boolean {
  return isUndefined(matchHostTypes) || isArray(matchHostTypes, isString);
}

/**
 * Returns whether both prefixes of `rule` are valid url prefixes, and its `matchHostTypes` is unset or a list of strings.
 */
export function isValidUrlReplacement(rule: UrlReplacement): boolean {
  return (
    isHttpUrlPrefix(rule.matchUrlPrefix) &&
    isHttpUrlPrefix(rule.replaceUrlPrefix) &&
    hasValidMatchHostTypes(rule)
  );
}

/**
 * Applies the global `urlReplacements` rules for `hostType` to `url`.
 */
function replaceUrl(
  url: string,
  hostType: string | undefined,
): UrlPrefixResult<UrlReplacement & UrlPrefixRule> {
  const rules = coerceArray(GlobalConfig.get('urlReplacements'))
    .filter(isValidUrlReplacement)
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
 * Returns whether the host rule carries credentials which a request would send, a client certificate, or any header.
 */
function hostRuleHasCredentials(hostRule: HostRule): boolean {
  return (
    hostRule.password !== undefined ||
    [
      hostRule.token,
      hostRule.httpsCertificate,
      hostRule.httpsPrivateKey,
      hostRule.httpsCertificateAuthority,
    ].some(isNonEmptyString) ||
    isNonEmptyObject(hostRule.headers)
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
    logger.debug(
      `urlReplacements: not replacing ${originalUrl}, the host is disabled`,
    );
    return url;
  }

  if (optionsHaveCredentials(options) || hostRuleHasCredentials(hostRule)) {
    logger.debug(
      `urlReplacements: not replacing ${originalUrl}, the request has credentials`,
    );
    return url;
  }

  logger.debug(`urlReplacements: replacing ${originalUrl} with ${replacedUrl}`);
  return parseUrl(replacedUrl)!;
}
