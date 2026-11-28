import { type UrlPrefixRule, replaceUrlPrefix } from '@renovatebot/base-image';
import { isNonEmptyObject, isNonEmptyString } from '@sindresorhus/is';
import { GlobalConfig } from '../../config/global.ts';
import type { UrlReplacement } from '../../config/types.ts';
import { logger } from '../../logger/index.ts';
import type { HostRule } from '../../types/index.ts';
import type { CombinedHostRuleWithTrustedHeaders } from '../host-rules.ts';
import { coerceObject } from '../object.ts';
import { regEx } from '../regex.ts';
import { ensureTrailingSlash, parseUrl } from '../url.ts';
import {
  getUrlReplacements,
  urlReplacementHostTypes,
} from '../url-replacements.ts';
import { credentialHeaders } from './host-guard.ts';
import { type HostRulesGotOptions, findMatchingRule } from './host-rules.ts';
import type { HttpError } from './index.ts';

interface ActiveUrlReplacements {
  urlReplacements: UrlReplacement[] | undefined;
  rules: UrlPrefixRule[];
}

let activeUrlReplacements: ActiveUrlReplacements | undefined;

/**
 * Returns the usable global `urlReplacements` as url prefix rules, computed again only when `urlReplacements` changes.
 */
function getActiveUrlReplacements(): readonly UrlPrefixRule[] {
  const urlReplacements = GlobalConfig.get('urlReplacements');
  if (
    !activeUrlReplacements ||
    activeUrlReplacements.urlReplacements !== urlReplacements
  ) {
    activeUrlReplacements = {
      urlReplacements,
      rules: getUrlReplacements(urlReplacements).map((rule) => ({
        from: rule.matchUrlPrefix,
        to: rule.replaceUrlPrefix,
      })),
    };
  }
  return activeUrlReplacements.rules;
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
 * Returns whether the host rule carries credentials which a request would send, a client certificate or key, or any header.
 */
function hostRuleHasCredentials(hostRule: HostRule): boolean {
  return (
    hostRule.password !== undefined ||
    [hostRule.token, hostRule.httpsCertificate, hostRule.httpsPrivateKey].some(
      isNonEmptyString,
    ) ||
    isNonEmptyObject(hostRule.headers)
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

export interface UrlReplacementResult {
  /** The URL to request. */
  fetchUrl: URL;
  /** The host rule for `fetchUrl`, when it was already looked up. */
  hostRule?: CombinedHostRuleWithTrustedHeaders;
}

const skipReasons = {
  'host-disabled': 'the host is disabled',
  'has-credentials': 'the request has credentials',
  'mirror-has-credentials': 'the mirror has credentials',
} as const;

type UrlReplacementDecision =
  | {
      type: 'replaced';
      replacedUrl: string;
      hostRule: CombinedHostRuleWithTrustedHeaders;
    }
  | {
      type: keyof typeof skipReasons;
      hostRule: CombinedHostRuleWithTrustedHeaders;
      matchUrlPrefix: string;
    };

/**
 * Returns whether and how the global `urlReplacements` rewrite `originalUrl`, or `undefined` when no rule applies or the host type is not supported.
 */
function decideUrlReplacement(
  originalUrl: string,
  options: HostRulesGotOptions,
): UrlReplacementDecision | undefined {
  const { hostType } = options;
  if (!hostType || !urlReplacementHostTypes.includes(hostType)) {
    return undefined;
  }

  const rules = getActiveUrlReplacements();
  if (!rules.length) {
    return undefined;
  }

  const { url: replacedUrl, applied } = replaceUrlPrefix(originalUrl, rules);
  if (!applied.length) {
    return undefined;
  }

  const matchUrlPrefix = applied[0].from;
  const hostRule = findMatchingRule(originalUrl, options);
  if (hostRule.enabled === false) {
    return { type: 'host-disabled', hostRule, matchUrlPrefix };
  }

  // a certificate authority alone is not authentication, but such hosts stay on their own connection settings
  if (optionsHaveCredentials(options) || hostRuleHasCredentialsOrCa(hostRule)) {
    return { type: 'has-credentials', hostRule, matchUrlPrefix };
  }

  // only mirrors without credentials are supported
  const mirrorHostRule = findMatchingRule(replacedUrl, options);
  if (hostRuleHasCredentials(mirrorHostRule)) {
    return { type: 'mirror-has-credentials', hostRule, matchUrlPrefix };
  }

  return { type: 'replaced', replacedUrl, hostRule: mirrorHostRule };
}

/**
 * Returns the URL to request instead of `url` according to the global `urlReplacements`, or `url` itself when no rule applies, the host type is not supported, the original host is disabled or has credentials, or the mirror has credentials.
 */
export function applyUrlReplacements(
  url: URL,
  options: HostRulesGotOptions,
): UrlReplacementResult {
  const originalUrl = url.toString();
  const decision = decideUrlReplacement(originalUrl, options);
  if (!decision) {
    return { fetchUrl: url };
  }

  if (decision.type !== 'replaced') {
    logger.once.debug(
      `urlReplacements: not replacing ${decision.matchUrlPrefix}, ${skipReasons[decision.type]}`,
    );
    return { fetchUrl: url, hostRule: decision.hostRule };
  }

  return {
    fetchUrl: parseUrl(decision.replacedUrl)!,
    hostRule: decision.hostRule,
  };
}

/**
 * Returns the URL which a read-only request of `hostType` to `url` goes to according to the global `urlReplacements`, or `undefined` when it keeps `url`.
 *
 * It decides on the host rules for `url` and for the mirror URL, without credentials of the request itself.
 */
export function getUrlReplacement(
  url: string,
  hostType: string | null | undefined,
): string | undefined {
  if (!hostType) {
    return undefined;
  }
  const normalizedUrl = parseUrl(url)?.href ?? url;
  const decision = decideUrlReplacement(normalizedUrl, {
    hostType,
    readOnly: true,
  });
  if (decision?.type !== 'replaced') {
    return undefined;
  }
  return decision.replacedUrl;
}

/**
 * Returns the URLs which read-only requests of `hostType` to the registry `registryUrl` go to according to the global `urlReplacements`: the replaced registry URL, and the replaced `matchUrlPrefix` of each rule below the registry URL.
 *
 * An `artifactregistry:` registry URL is handled as the `https:` URL which is requested.
 */
export function getRegistryUrlReplacements(
  registryUrl: string,
  hostType: string | null | undefined,
): string[] {
  const httpUrl = registryUrl.replace(regEx(/^artifactregistry:/), 'https:');
  const registryPrefix = ensureTrailingSlash(
    parseUrl(httpUrl)?.href ?? httpUrl,
  );
  const nestedPrefixes = getActiveUrlReplacements()
    .map((rule) => rule.from)
    .filter(
      (prefix) =>
        prefix !== registryPrefix && prefix.startsWith(registryPrefix),
    );
  return [registryPrefix, ...nestedPrefixes]
    .map((url) => getUrlReplacement(url, hostType))
    .filter(isNonEmptyString);
}

/**
 * Returns whether the failed request went to a URL rewritten by `urlReplacements`.
 */
export function isUrlReplacedError(err: HttpError): boolean {
  return err.options?.context?.urlReplaced === true;
}
