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
import { HOST_BLOCKED } from '../../constants/error-messages.ts';
import { logger } from '../../logger/index.ts';
import type { HostRule } from '../../types/index.ts';
import { coerceArray } from '../array.ts';
import { coerceObject } from '../object.ts';
import { isHttpUrlPrefix, parseUrl } from '../url.ts';
import { RequestError } from './got.ts';
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
export function hostRuleHasCredentials(hostRule: HostRule): boolean {
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

export interface UrlReplacementResult {
  url: URL;
  /** all applied rules are `public`, so the request must not carry the caller's credentials */
  public: boolean;
  /** all applied rules have `fallback` */
  fallback: boolean;
  /** the replaced request had credentials of the caller or of the original host's rule, which a `public` rule removed */
  hadCredentials: boolean;
}

/**
 * Returns the URL to request instead of `url` according to the global `urlReplacements`, or `url` itself when no rule applies, the host type is excluded, the original host is disabled, or it has credentials and a rule isn't `public`.
 */
export function applyUrlReplacements(
  url: URL,
  options: HostRulesGotOptions,
): UrlReplacementResult {
  const unchanged = {
    url,
    public: false,
    fallback: false,
    hadCredentials: false,
  };
  if (excludedHostTypes.includes(options.hostType)) {
    return unchanged;
  }

  const originalUrl = url.toString();
  const { url: replacedUrl, applied } = replaceUrl(
    originalUrl,
    options.hostType,
  );
  if (!applied.length) {
    return unchanged;
  }

  const hostRule = findMatchingRule(originalUrl, options);
  if (hostRule.enabled === false) {
    logger.debug(
      `urlReplacements: not replacing ${originalUrl}, the host is disabled`,
    );
    return unchanged;
  }

  const isPublic = applied.every((rule) => rule.public === true);
  const hasCredentials =
    optionsHaveCredentials(options) || hostRuleHasCredentials(hostRule);
  if (!isPublic && hasCredentials) {
    logger.debug(
      `urlReplacements: not replacing ${originalUrl}, the request has credentials`,
    );
    return unchanged;
  }

  logger.debug(`urlReplacements: replacing ${originalUrl} with ${replacedUrl}`);
  return {
    url: parseUrl(replacedUrl)!,
    public: isPublic,
    fallback: applied.every((rule) => rule.fallback === true),
    hadCredentials: hasCredentials,
  };
}

/**
 * Returns a copy of `options` without the caller's `token`, `username`, `password` and credential headers.
 */
export function removeCredentials<T extends HostRulesGotOptions>(
  options: T,
): T {
  const {
    token: _token,
    username: _username,
    password: _password,
    ...rest
  } = options;
  const headers = Object.fromEntries(
    Object.entries(coerceObject(options.headers)).filter(
      ([name]) => !credentialHeaders.includes(name.toLowerCase()),
    ),
  );
  return { ...rest, headers } as T;
}

// OpenSSL certificate verification errors, as reported by Node
const certificateErrorCodes: readonly string[] = [
  'CERT_CHAIN_TOO_LONG',
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'CERT_REJECTED',
  'CERT_REVOKED',
  'CERT_SIGNATURE_FAILURE',
  'CERT_UNTRUSTED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'HOSTNAME_MISMATCH',
  'INVALID_CA',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_DECRYPT_CERT_SIGNATURE',
  'UNABLE_TO_DECODE_ISSUER_PUBLIC_KEY',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
];

/**
 * Returns whether `code` is a TLS or certificate error code.
 */
function isTlsErrorCode(code: string): boolean {
  return (
    certificateErrorCodes.includes(code) ||
    code.startsWith('ERR_TLS_') ||
    code.startsWith('ERR_SSL_')
  );
}

/**
 * Returns whether a failed request to a mirror is retried against the original URL: a connection error or timeout without response, or a 5xx response, but not a TLS error or a blocked host.
 */
export function isFallbackError(err: unknown): boolean {
  if (
    !(err instanceof RequestError) ||
    err.message === HOST_BLOCKED ||
    isTlsErrorCode(err.code)
  ) {
    return false;
  }
  const statusCode = err.response?.statusCode;
  return statusCode === undefined || statusCode >= 500;
}
