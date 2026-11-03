import {
  isFalsy,
  isNonEmptyString,
  isString,
  isTruthy,
  isUndefined,
} from '@sindresorhus/is';
import { GlobalConfig } from '../config/global.ts';
import type { PlatformFamilyId } from '../constants/platforms.ts';
import { PLATFORM_FAMILIES } from '../constants/platforms.ts';
import { logger } from '../logger/index.ts';
import type {
  CombinedHostRule,
  HostRule,
  InternalHostGrant,
} from '../types/index.ts';
import { clone } from './clone.ts';
import { toSha256 } from './hash.ts';
import { regEx } from './regex.ts';
import * as sanitize from './sanitize.ts';
import { toBase64 } from './string.ts';
import { matchRegexOrGlobList } from './string-match.ts';
import {
  decodeUserinfo,
  ensureTrailingSlash,
  isCredentialUserinfo,
  isHttpUrl,
  isPlaceholderUsername,
  isUserinfoPlaceholder,
  massageHostUrl,
  parseUrl,
  stripUrlCredentials,
  trimTrailingSlash,
  urlUserinfoRegex,
} from './url.ts';

/**
 * How much a host rule is trusted, according to the configuration it came from, from most to least trusted:
 *
 * - `admin`: the self-hosted administrator's own configuration - their global config, or a `repositories[]` entry
 * - `inherit`: organization-inherited config, and only where the administrator has opted into trusting it through `inheritConfigTrusted`
 * - `untrusted`: repository configuration, and the presets it extends
 */
type HostRuleTrustTier = 'admin' | 'inherit' | 'untrusted';

/**
 * A host rule as registered through {@link add}.
 *
 * `trustTier` is deliberately not a field of `HostRule`: it is set from {@link AddHostRuleOptions} at registration time and must never be settable through configuration.
 */
interface RegisteredHostRule extends HostRule {
  /** which configuration the rule came from - see {@link HostRuleTrustTier}. Always set by `add()`, but optional so that `find()` can delete it from its result */
  trustTier?: HostRuleTrustTier;

  /** never set by us, and declared only so that a `trusted` smuggled in through configuration can be deleted before the rule is registered. It was the boolean `trustTier` replaced, so a rule carrying one may well be an attempt at the administrator's precedence */
  trusted?: never;

  /** set only by {@link find}; see {@link CombinedHostRuleWithTrustedHeaders.trustedHeaderNames} */
  trustedHeaderNames?: string[];
}

/**
 * A {@link CombinedHostRule} returned by {@link find}, additionally reporting which of its `headers` came from an `admin` tier rule.
 *
 * `trustedHeaderNames` is deliberately not a field of `HostRule`, for the same reason `trustTier` is not: it must never be settable through configuration.
 */
export interface CombinedHostRuleWithTrustedHeaders extends CombinedHostRule {
  /** header names in `headers` that came from an `admin` tier rule (the self-hosted administrator's own config), and so already bypassed `allowedHeaders` at registration - `applyHostRule`'s request-time defence-in-depth must not re-check, and drop, them */
  trustedHeaderNames?: string[];
}

let hostRules: RegisteredHostRule[] = [];

/**
 * The credentials of a host rule registered by {@link detachUrlCredentials}.
 */
interface DetachedCredentials {
  /** the URL the credentials apply to, without a trailing slash */
  url: string;
  username: string;
  password: string;
}

let detachedCredentials: DetachedCredentials[] = [];

/**
 * The host rules registered by {@link detachUrlCredentials}.
 */
let detachedRules = new WeakSet<HostRule>();

/**
 * Fields within `HostRule`s that must have their value registered for sanitising through `sanitize.addSecretForSanitizing()`.
 *
 * Kept in sync with `redactedFields` through tests.
 */
export const confidentialFields: (keyof HostRule)[] = [
  'password',
  'token',
  'httpsPrivateKey',
  /* not actually sensitive, but redacted nonetheless */
  'httpsCertificate',
  /* not actually sensitive, but redacted nonetheless */
  'httpsCertificateAuthority',
];

export interface LegacyHostRule {
  hostName?: string;
  domainName?: string;
  baseUrl?: string;
  host?: string;
  endpoint?: string;
}

export function migrateRule(rule: LegacyHostRule & HostRule): HostRule {
  const cloned: LegacyHostRule & HostRule = clone(rule);
  delete cloned.hostName;
  delete cloned.domainName;
  delete cloned.baseUrl;
  const result: HostRule = cloned;

  const { matchHost } = result;
  const { hostName, domainName, baseUrl } = rule;
  const hostValues = [matchHost, hostName, domainName, baseUrl].filter(
    isTruthy,
  );
  if (hostValues.length === 1) {
    const [matchHost] = hostValues;
    result.matchHost = matchHost;
  } else if (hostValues.length > 1) {
    throw new Error(
      `hostRules cannot contain more than one host-matching field - use "matchHost" only.`,
    );
  }

  return result;
}

/**
 * Enforce the `allowedHeaders` allowlist on a set of host rules.
 *
 * Loudly remove anything that's not permitted, logging a WARN. Used by `add()` for an untrusted rule's `headers`; a `trusted` rule's are exempt, so never reach this.
 *
 * Headers that survive this allowlist are still subject to how {@link find} combines them: an admin's headers for a host are applied over those of any repository or preset rule matching the same request, so a repository can neither drop nor substitute them.
 */
export function filterAllowedHeaders(rules: HostRule[]): HostRule[] {
  const allowlist = GlobalConfig.get('allowedHeaders');
  const denied: string[] = [];

  const result = rules.map((rule) => {
    if (!rule.headers) {
      return rule;
    }

    const allowed: Record<string, string> = {};
    const ruleDenied: string[] = [];
    for (const [name, value] of Object.entries(rule.headers)) {
      if (matchRegexOrGlobList(name, allowlist)) {
        allowed[name] = value;
      } else {
        ruleDenied.push(name);
      }
    }

    if (!ruleDenied.length) {
      return rule;
    }
    denied.push(...ruleDenied);

    const filtered: HostRule = { ...rule, headers: allowed };
    if (!Object.keys(allowed).length) {
      // drop the key rather than leave an empty object behind: `find()` treats any rule that sets `headers` as replacing the headers of the broader rules of its own tier, so a rule left with none would suppress them
      delete filtered.headers;
    }
    return filtered;
  });

  if (denied.length) {
    logger.warn(
      { denied },
      "Ignoring hostRules headers not permitted by this Renovate instance's `allowedHeaders`",
    );
  }
  return result;
}

export interface AddHostRuleOptions {
  /**
   * Whether this rule comes from the self-hosted administrator's own configuration, rather than from repository or preset config.
   *
   * Registers the rule into the `admin` tier - see {@link HostRuleTrustTier}.
   */
  trusted?: boolean;

  /**
   * Whether this rule comes from organization-inherited config which the administrator has opted into trusting, through `inheritConfigTrusted`.
   *
   * Registers the rule into the `inherit` tier - see {@link HostRuleTrustTier}. Ignored when `trusted` is also set.
   */
  inherited?: boolean;
}

/**
 * The trust tier a caller asked for.
 *
 * Deliberately opt-in: a caller that says nothing registers into the untrusted tier, so a new call site cannot grant itself the administrator's precedence by omission.
 */
function trustTierFor(options?: AddHostRuleOptions): HostRuleTrustTier {
  if (options?.trusted) {
    return 'admin';
  }
  if (options?.inherited) {
    return 'inherit';
  }
  return 'untrusted';
}

/**
 * Registers a host rule, without registering its confidential fields for sanitizing.
 *
 * @returns the registered rule
 */
function register(
  params: HostRule,
  options?: AddHostRuleOptions,
): RegisteredHostRule {
  let rule: RegisteredHostRule = {
    ...migrateRule(params),
    // set only from `options`, and assigned unconditionally so that it cannot be carried over from `params`: `HostRule` has no `trustTier` field, but configuration is parsed from JSON, so a repository could otherwise smuggle one in and have its rules treated as the administrator's
    trustTier: trustTierFor(options),
  };
  // as above, for the boolean this tier replaced, and for the header names `find()` computes from it
  delete rule.trusted;
  delete rule.trustedHeaderNames;

  // like the trust tier, `allowInternal` may only come from configuration the administrator trusts: a repository or preset rule must not be able to grant itself access to internal hosts
  if (!isUndefined(rule.allowInternal) && rule.trustTier === 'untrusted') {
    logger.debug(
      `Ignoring hostRules allowInternal for ${rule.matchHost ?? rule.hostType} from untrusted config`,
    );
    delete rule.allowInternal;
  }

  if (rule.headers && rule.trustTier !== 'admin') {
    // enforced here, at the single registration chokepoint, so that no current or future caller can register a rule whose headers bypass `allowedHeaders`; `applyHostRule` filters by header name again at request time as defence in depth
    // `allowedHeaders` constrains what a repository or preset may set, not the self-hosted administrator - the same exemption `filterAllowedEnv` gives the admin's own `env`, just enforced through the `admin` trust tier here rather than a name+value comparison, as `headers` are host-scoped
    [rule] = filterAllowedHeaders([rule]);
  }

  if (rule.matchHost) {
    rule.matchHost = massageHostUrl(rule.matchHost);
    const parsedUrl = parseUrl(rule.matchHost);
    rule.resolvedHost = parsedUrl?.hostname ?? rule.matchHost;
    confidentialFields.forEach((field) => {
      if (rule[field]) {
        logger.debug(
          // TODO: types (#22198)
          `Adding ${field} authentication for ${rule.matchHost!} (hostType=${
            rule.hostType
          }) to hostRules`,
        );
      }
    });
  }
  hostRules.push(rule);
  return rule;
}

export function add(params: HostRule, options?: AddHostRuleOptions): void {
  const rule = register(params, options);
  confidentialFields.forEach((field) => {
    const secret = rule[field];
    if (isString(secret) && secret.length > 3) {
      sanitize.addSecretForSanitizing(secret);
    }
  });
  if (rule.username && rule.password) {
    sanitize.addSecretForSanitizing(
      toBase64(`${rule.username}:${rule.password}`),
    );
  }
}

/**
 * The platform host types whose host rules `findMatchingRule()` falls back to for the other host types of their family.
 */
const fallbackPlatformHostTypes = [
  'bitbucket',
  'bitbucket-server',
  'forgejo',
  'gitea',
  'github',
  'gitlab',
] as const satisfies PlatformFamilyId[];

/**
 * Returns `hostTypes` and the platform host type each of them falls back to.
 */
function withFallbackHostTypes(hostTypes: string[]): string[] {
  const platformHostTypes = fallbackPlatformHostTypes.filter((platform) =>
    PLATFORM_FAMILIES[platform].apiUsingHostTypes.some((hostType) =>
      hostTypes.includes(hostType),
    ),
  );
  return [...hostTypes, ...platformHostTypes];
}

/**
 * Whether a request of `url` with any `hostType` falls back to the `github` host rules: a request of the GitHub.com API, or of the host of the GitHub platform endpoint, such as GitHub Enterprise Server or GitHub Enterprise Cloud.
 */
export function usesGithubUrlFallback(url: string): boolean {
  if (url.startsWith('https://api.github.com/')) {
    return true;
  }
  const platformEndpoint = GlobalConfig.get('endpoint');
  if (GlobalConfig.get('platform') !== 'github' || !platformEndpoint) {
    return false;
  }
  const requestHost = parseUrl(url)?.hostname;
  return !!requestHost && requestHost === parseUrl(platformEndpoint)?.hostname;
}

/**
 * Whether `rule` was registered by {@link detachUrlCredentials}.
 */
function isDetached(rule: RegisteredHostRule): boolean {
  return detachedRules.has(rule);
}

/**
 * Returns the host rules other than those registered by {@link detachUrlCredentials}.
 */
function configuredRules(): RegisteredHostRule[] {
  return hostRules.filter((rule) => !isDetached(rule));
}

/**
 * Whether {@link find} matches `rule` for a search with `readOnly` whatever its `hostType`: when the rule sets `readOnly` to the same value.
 */
function matchesReadOnly(
  rule: HostRule,
  readOnly: boolean | undefined,
): boolean {
  return !isUndefined(rule.readOnly) && rule.readOnly === readOnly;
}

/**
 * Whether `rule` applies to the scope `matchHost` of {@link detachUrlCredentials} requested with one of `hostTypes`: a detached rule only for the same `matchHost`, any other rule when it has no `hostType`, one of `hostTypes` or `readOnly: true`, and no `matchHost` or one which matches `matchHost` or lies within it.
 */
function appliesToScope(
  rule: RegisteredHostRule,
  matchHost: string,
  hostTypes: string[],
): boolean {
  if (isDetached(rule)) {
    return rule.matchHost === matchHost && hostTypes.includes(rule.hostType!);
  }
  // a rule for another `hostType`, such as the platform's for the same host, is not used for these requests
  // unless it is one for read-only requests, which `find()` uses for the lookups whatever their `hostType`
  if (
    rule.hostType &&
    !hostTypes.includes(rule.hostType) &&
    !matchesReadOnly(rule, true)
  ) {
    return false;
  }
  return (
    !rule.matchHost ||
    matchesHost(matchHost, rule.matchHost) ||
    matchesHost(rule.matchHost, matchHost)
  );
}

/**
 * Whether a host rule which {@link appliesToScope} `matchHost` requested with one of `hostTypes`, the platform host type they fall back to, or `github` when {@link usesGithubUrlFallback} for `matchHost`, supplies credentials.
 */
function hasConfiguredCredentials(
  matchHost: string,
  hostTypes: string[],
): boolean {
  const searchedHostTypes = withFallbackHostTypes(hostTypes);
  if (usesGithubUrlFallback(matchHost)) {
    searchedHostTypes.push('github');
  }
  return hostRules.some(
    (rule) =>
      appliesToScope(rule, matchHost, searchedHostTypes) &&
      [rule.username, rule.password, rule.token].some(
        (value) => !isUndefined(value),
      ),
  );
}

/**
 * Returns `text` without the userinfo of the URL at its start, or `text` unchanged when that URL has none.
 */
function withoutLeadingUserinfo(text: string): string {
  // only a userinfo at the start of `text` belongs to that URL, a later one is part of its path or query
  const [match] = text.matchAll(urlUserinfoRegex);
  if (match?.index !== 0) {
    return text;
  }
  return `${match.groups!.scheme}://${text.slice(match[0].length)}`;
}

/**
 * Returns `url` without its userinfo, spelled as given, or as the parser normalizes it when the two disagree.
 */
function withoutUserinfo(url: string, parsed: URL): string {
  const stripped = withoutLeadingUserinfo(url);
  const reparsed = parseUrl(stripped);
  if (
    reparsed?.host !== parsed.host ||
    reparsed?.username ||
    reparsed?.password
  ) {
    return stripUrlCredentials(parsed);
  }
  return stripped;
}

/**
 * Returns the parsed `url` when it is an HTTP(S) URL with a userinfo other than a placeholder username alone, or `null`.
 */
function parseUserinfoUrl(url: string): URL | null {
  if (!url.includes('@')) {
    return null;
  }
  const parsed = parseUrl(url);
  if (!parsed || !isHttpUrl(parsed) || (!parsed.username && !parsed.password)) {
    return null;
  }
  // a rule for the placeholder would supply it as a credential and stop the lookup which resolves the real one
  if (!parsed.password && isPlaceholderUsername(parsed.username)) {
    return null;
  }
  return parsed;
}

/**
 * Whether the password of `parsed` is a template placeholder, or the username when there is no password, as {@link isCredentialUserinfo} reads them.
 */
function hasTemplatePlaceholder(parsed: URL): boolean {
  // the URL parser percent-encodes the braces of a placeholder, which `isUserinfoPlaceholder` decodes
  // a placeholder username next to a literal password does not make that password a placeholder
  return isUserinfoPlaceholder(parsed.password || parsed.username);
}

/**
 * Whether the userinfo of `parsed` holds a credential according to {@link isCredentialUserinfo}.
 */
function hasCredentialUserinfo(parsed: URL): boolean {
  const scheme = parsed.protocol.slice(0, -1);
  const userinfo = parsed.password
    ? `${parsed.username}:${parsed.password}`
    : parsed.username;
  return isCredentialUserinfo(
    scheme,
    userinfo,
    `${parsed.host}${parsed.pathname}`,
  );
}

/**
 * The minimum length of a credential from a URL which is registered for sanitizing.
 */
const minSanitizedUrlSecretLength = 16;

/**
 * Registers each of `secrets` for sanitizing which is at least {@link minSanitizedUrlSecretLength} characters long.
 */
function addUrlSecretsForSanitizing(secrets: string[]): void {
  for (const secret of secrets.filter(
    (value) => value.length >= minSanitizedUrlSecretLength,
  )) {
    sanitize.addSecretForSanitizing(secret);
  }
}

/**
 * The prefix of a crate sparse registry URL such as `sparse+https://`, which is requested without it.
 */
const sparsePrefix = 'sparse+';

/**
 * Moves the `user:password@` userinfo of an HTTP(S) URL, or of the HTTP(S) URL of a `sparse+https://` one, into a host rule per host type in `hostTypes` for the path of that URL and every path below it, unless credentials for that host type are already supplied by a rule registered from URL credentials for exactly that path and host type, or by another rule for no host type, that host type or the platform host type it falls back to, which has no `matchHost` or one for that path, a path above or a path below it.
 * The credentials are dropped when no host type is left.
 *
 * @param hostTypes the host types the URL is requested with
 * @returns the URL with only its userinfo removed, or `url` unchanged when it carries none, only a placeholder username, a short username or a username equal to its first path segment
 */
export function detachUrlCredentials(url: string, hostTypes: string[]): string {
  // the crate datasource requests a `sparse+https://` registry by its `https://` URL
  if (url.startsWith(sparsePrefix)) {
    return `${sparsePrefix}${detachUrlCredentials(url.slice(sparsePrefix.length), hostTypes)}`;
  }
  const parsed = parseUserinfoUrl(url);
  if (!parsed) {
    return url;
  }
  // textually, so that the URL is spelled as the same URL without credentials
  const strippedUrl = withoutUserinfo(url, parsed);
  // a `${USER}:${PASS}@` placeholder is not a credential either, the configured rules supply it
  if (hasTemplatePlaceholder(parsed)) {
    return strippedUrl;
  }
  if (!hasCredentialUserinfo(parsed)) {
    return url;
  }
  const username = decodeUserinfo(parsed.username);
  const password = decodeUserinfo(parsed.password);
  // `token@host` is Basic auth with the token as the username
  // a short credential is more likely a plain account name than a token, and would redact every occurrence of that name, such as in branch names
  const secret = password || username;
  // the path of the URL without its query, and every path below it, but no sibling path such as `/projects/10` next to `/projects/1`
  const scopeUrl = trimTrailingSlash(`${parsed.origin}${parsed.pathname}`);
  // a `matchHost` ending with a slash also matches the URL of that path itself
  const matchHost = `${scopeUrl}/`;
  // configured credentials for the path win over the ones embedded in a URL, so a repository cannot replace them
  // a configured rule counts for the `hostType` it is used with by `find()`: without one, the same one, or the platform host type it falls back to
  // a configured rule for a path below this one counts as well, as the rule registered here would override its token on the requests below that path
  // this also keeps the credentials registered first for the same path and `hostType`, while those of a narrower path are registered next to them and win below it
  const unsuppliedHostTypes = [...new Set(hostTypes)].filter(
    (hostType) => !hasConfiguredCredentials(matchHost, [hostType]),
  );
  if (!unsuppliedHostTypes.length) {
    // dropped, but still redacted wherever the URL is repeated
    addUrlSecretsForSanitizing([secret]);
    return strippedUrl;
  }
  // one rule per `hostType`, so that only the requests of those host types receive the credentials
  // registered without `add()`, which would register a short password for sanitizing as well
  for (const hostType of unsuppliedHostTypes) {
    detachedRules.add(register({ hostType, matchHost, username, password }));
  }
  // the same credentials detached again for other host types keep a single entry, so that their hash does not change
  const isKnown = detachedCredentials.some(
    (credentials) =>
      credentials.url === scopeUrl &&
      credentials.username === username &&
      credentials.password === password,
  );
  if (!isKnown) {
    detachedCredentials.push({ url: scopeUrl, username, password });
  }
  const basicAuth = password ? toBase64(`${username}:${password}`) : '';
  addUrlSecretsForSanitizing([secret, basicAuth]);
  return strippedUrl;
}

/**
 * Matches the characters which may follow a URL inside a text without extending its last path segment.
 */
const urlEndRegex = regEx(/^(?:[/?#:,\s]|$)/);

/**
 * Matches the scheme, host, numeric port and path of the URL at the start of a text, if any, which ends at its query, fragment, a comma, whitespace or a colon after the host.
 */
const leadingUrlRegex = regEx(
  /^(?:[a-z][a-z\d+.-]*:\/\/[^/?#,\s:]*(?::\d+)?(?:\/[^?#,\s]*)?)?/i,
);

/**
 * Returns `text` with the origin and path of the HTTP(S) URL at its start spelled as {@link detachUrlCredentials} scopes them, or `text` unchanged when there is no such URL or it has a userinfo.
 */
function withNormalizedLeadingUrl(text: string): string {
  // the regex matches every text, an empty match when it does not start with a URL
  const [leadingUrl] = leadingUrlRegex.exec(text)!;
  const parsed = parseUrl(leadingUrl);
  if (!parsed || !isHttpUrl(parsed) || parsed.username || parsed.password) {
    return text;
  }
  const scopeUrl = trimTrailingSlash(`${parsed.origin}${parsed.pathname}`);
  return `${scopeUrl}${text.slice(leadingUrl.length)}`;
}

/**
 * Whether {@link detachUrlCredentials} registered any credentials.
 */
export function hasDetachedCredentials(): boolean {
  return detachedCredentials.length > 0;
}

/**
 * Returns the username and password which {@link detachUrlCredentials} registered for `url` requested with `hostType`, those of the longest matching path, or `null` when there are none.
 */
export function findDetachedCredentials({
  hostType,
  url,
}: {
  hostType: string;
  url: string;
}): Pick<HostRule, 'username' | 'password'> | null {
  const rule = hostRules
    .filter(
      (rule) =>
        isDetached(rule) &&
        rule.hostType === hostType &&
        matchesHost(url, rule.matchHost!),
    )
    .sort(fromShorterToLongerMatchHost)
    .pop();
  if (!rule) {
    return null;
  }
  return { username: rule.username, password: rule.password };
}

/**
 * Returns the SHA-256 of the credentials which {@link detachUrlCredentials} registered for the URL at the start of `text`, in any spelling of its origin and path and with or without its userinfo, or `null` when there are none.
 */
export function getDetachedCredentialsHash(text: string): string | null {
  // a `sparse+https://` URL has the credentials of its `https://` URL
  const urlText = text.startsWith(sparsePrefix)
    ? text.slice(sparsePrefix.length)
    : text;
  // compared as given and without the userinfo of its URL: `find()` ignores that userinfo, while in a key such as `https://host:@scope/pkg` it is part of a package name
  const normalizedTexts = [urlText, withoutLeadingUserinfo(urlText)].map(
    withNormalizedLeadingUrl,
  );
  const credentials = detachedCredentials
    .filter(({ url }) =>
      normalizedTexts.some(
        (normalizedText) =>
          normalizedText.startsWith(url) &&
          urlEndRegex.test(normalizedText.slice(url.length)),
      ),
    )
    .map(({ username, password }) => [username, password]);
  if (!credentials.length) {
    return null;
  }
  return toSha256(JSON.stringify(credentials));
}

export interface HostRuleSearch {
  hostType?: string;
  url?: string;
  readOnly?: boolean;
}

export interface MatchesHostOptions {
  /** match an HTTP(S) `url` by its prefix only, so that a `matchHost` ending with a slash does not match the URL of that path without the slash */
  prefixOnly?: boolean;
}

export function matchesHost(
  url: string,
  matchHost: string,
  { prefixOnly = false }: MatchesHostOptions = {},
): boolean {
  const parsedUrl = parseUrl(url);
  if (!parsedUrl) {
    return false;
  }

  const parsedMatchHost = parseUrl(matchHost);
  if (isHttpUrl(parsedUrl) && isHttpUrl(parsedMatchHost)) {
    const { href } = parsedMatchHost!;
    // ignore any userinfo (`user:pass@`) on the searched URL, so a `matchHost` without credentials still matches
    // a `matchHost` ending with a slash also matches the URL of that path itself, without the slash
    return (
      stripUrlCredentials(parsedUrl).startsWith(href) ||
      (!prefixOnly &&
        ensureTrailingSlash(`${parsedUrl.origin}${parsedUrl.pathname}`) ===
          href)
    );
  }

  const { hostname } = parsedUrl;
  if (!hostname) {
    return false;
  }

  if (hostname === matchHost) {
    return true;
  }

  const topLevelSuffix = matchHost.startsWith('.')
    ? matchHost
    : `.${matchHost}`;
  return hostname.endsWith(topLevelSuffix);
}

function fromShorterToLongerMatchHost(a: HostRule, b: HostRule): number {
  if (!a.matchHost || !b.matchHost) {
    return 0;
  }
  return a.matchHost.length - b.matchHost.length;
}

function hostRuleRank({ hostType, matchHost, readOnly }: HostRule): number {
  if ((hostType || readOnly) && matchHost) {
    return 3;
  }

  if (matchHost) {
    return 2;
  }

  if (hostType) {
    return 1;
  }

  return 0;
}

function fromLowerToHigherRank(a: HostRule, b: HostRule): number {
  return hostRuleRank(a) - hostRuleRank(b);
}

// A single comparator, rather than two consecutive sorts: `fromShorterToLongerMatchHost` returns 0 for rules without a `matchHost`, which makes it non-transitive on its own, so a standalone length sort could leave two `matchHost` rules unordered when a host-less rule sits between them
function fromLowerRankAndShorterMatchHost(a: HostRule, b: HostRule): number {
  return fromLowerToHigherRank(a, b) || fromShorterToLongerMatchHost(a, b);
}

/**
 * The `headers` that apply from a set of matching rules of the same trust tier.
 *
 * The last rule to set any wins outright, as `find()`'s callers receive them sorted from least to most specific. That is the behaviour every matching rule had before `headers` were combined across tiers, and it is what lets a broad rule's headers be masked by a narrower rule from the same source.
 */
function headersOfLastRuleToSetThem(
  rules: RegisteredHostRule[],
): Record<string, string> | undefined {
  return rules
    .map((rule) => rule.headers)
    .filter(isTruthy)
    .pop();
}

/**
 * The last defined value, following the same "most specific rule wins" ordering as {@link headersOfLastRuleToSetThem}.
 */
function lastDefined<T>(values: (T | undefined)[]): T | undefined {
  return values.filter((value) => !isUndefined(value)).pop();
}

/**
 * The rules whose grant is deliberately scoped, by a `hostType` or by a URL-prefix `matchHost` - see {@link InternalHostGrant}.
 */
function scopedRules(rules: RegisteredHostRule[]): RegisteredHostRule[] {
  return rules.filter(
    (rule) => isNonEmptyString(rule.hostType) || isHttpUrl(rule.matchHost),
  );
}

export function find(
  search: HostRuleSearch,
): CombinedHostRuleWithTrustedHeaders {
  if ([search.hostType, search.url].every(isFalsy)) {
    logger.warn({ search }, 'Invalid hostRules search');
    return {};
  }

  // Sort primarily by rank, and secondarily by matchHost length
  const sortedRules = hostRules.sort(fromLowerRankAndShorterMatchHost);

  const matchedRules: RegisteredHostRule[] = [];
  for (const rule of sortedRules) {
    let hostTypeMatch = true;
    let hostMatch = true;
    let readOnlyMatch = true;

    if (rule.hostType) {
      hostTypeMatch = false;
      // v8 ignore else -- TODO: add test #40625
      if (search.hostType === rule.hostType) {
        hostTypeMatch = true;
      }
    }

    if (rule.matchHost && rule.resolvedHost) {
      hostMatch = false;
      if (search.url) {
        hostMatch = matchesHost(search.url, rule.matchHost);
      }
    }

    if (!isUndefined(rule.readOnly)) {
      readOnlyMatch = false;
      // v8 ignore else -- TODO: add test #40625
      if (matchesReadOnly(rule, search.readOnly)) {
        readOnlyMatch = true;
        hostTypeMatch = true; // When we match `readOnly`, we don't care about `hostType`
      }
    }

    if (hostTypeMatch && readOnlyMatch && hostMatch) {
      matchedRules.push(clone(rule));
    }
  }

  const res: RegisteredHostRule & Pick<CombinedHostRule, 'internalHostGrant'> =
    Object.assign({}, ...matchedRules);

  // the sensitive fields below are resolved a trust tier at a time, so that the outcome cannot depend on how specific a rule from a less trusted tier makes itself
  const trustedRules = matchedRules.filter(
    (rule) => rule.trustTier === 'admin',
  );
  const inheritedRules = matchedRules.filter(
    (rule) => rule.trustTier === 'inherit',
  );
  const untrustedRules = matchedRules.filter(
    (rule) => rule.trustTier === 'untrusted',
  );

  // `headers` are resolved per trust tier and then combined key by key, so that repository or preset config can no longer discard - or substitute - the headers a self-hosted admin configured for the same host
  // Within a tier nothing changes: the most specific rule's `headers` still replace those of the broader rules it is combined with, so an admin masking their own broad rule with a narrower one keeps working, as does a repository doing the same among its own rules
  // This is deliberately scoped to `headers` alone, as combining any more of the fields than we already do has caused authentication regressions before: an inherited `token` and a specific rule's `username`/`password` are not meant to be used together
  const untrustedHeaders = headersOfLastRuleToSetThem(untrustedRules);
  const inheritedHeaders = headersOfLastRuleToSetThem(inheritedRules);
  const trustedHeaders = headersOfLastRuleToSetThem(trustedRules);
  if (untrustedHeaders ?? inheritedHeaders ?? trustedHeaders) {
    // the admin's own headers are applied last, so neither a repository nor inherited config can override one they set for this host
    res.headers = {
      ...untrustedHeaders,
      ...inheritedHeaders,
      ...trustedHeaders,
    };
    // set as a pair with `headers`, even to `[]` when nothing is trusted, rather than only when there are trusted headers: `findMatchingRule`'s hostType fallbacks combine results with `{ ...fallbackResult, ...res }`, and a plain object spread only overrides a key that `res` actually carries - a key `res` never set at all would let a `fallbackResult.trustedHeaderNames` show through underneath it
    // concretely, this stops an admin's trusted `github` hostType rule leaking its trusted status onto an unrelated, untrusted `github-tags` rule for the same header name: without `res.trustedHeaderNames` set to `[]` here, the repository's own header would inherit the admin's exemption from `allowedHeaders` once the two results are combined - see "does not let a fallback hostType's trustedHeaderNames leak onto a rule's own untrusted headers" in `lib/util/http/host-rules.spec.ts`, and "keeps `trustedHeaderNames` as an explicit key, set to `[]`, when only untrusted headers match" below, for this in practice
    // an empty array rather than `undefined`, unlike the rest of this function's optional fields: `undefined`-valued properties are invisible to `toEqual`, which would silently let a caller's assertion miss a regression in the shadowing above - every other test asserting on a plain `{ headers: {...} }` result must now spell out `trustedHeaderNames: []` too, which is deliberate
    // never set when `res.headers` isn't either, so a `find()` with no matching headers still returns `{}` rather than `{ trustedHeaderNames: [] }`, which callers that check for an empty result (e.g. `isNonEmptyObject`) rely on
    // tracked so that `applyHostRule`'s request-time defence-in-depth knows which of `res.headers` already bypassed `allowedHeaders` at registration as the administrator's own, and does not re-drop them
    res.trustedHeaderNames = trustedHeaders ? Object.keys(trustedHeaders) : [];
  }

  // `enabled` is resolved per trust tier like `headers`: a repository or preset rule must not be able to re-enable a host the administrator's own rules disabled (or vice versa) by out-specifying them with a longer `matchHost`
  const enabled =
    lastDefined(trustedRules.map((rule) => rule.enabled)) ??
    lastDefined(inheritedRules.map((rule) => rule.enabled)) ??
    lastDefined(untrustedRules.map((rule) => rule.enabled));
  if (!isUndefined(enabled)) {
    res.enabled = enabled;
  }

  // computed here and never from configuration: `add()` strips `allowInternal` from untrusted registrations, so only rules from configuration the administrator trusts can contribute
  // the admin's own rules are resolved first, and an `allowInternal: false` of theirs is an absolute veto: inherited config cannot talk an organization's way back in through any grant shape, whether scoped, unscoped, or merely implicit in naming the host
  // each shape must therefore be resolved from the admin tier's verdict rather than falling through to the inherit tier on its own - a bare admin rule sets no scoped verdict, and an inherited scoped grant would otherwise fill the gap for exactly the requests which consult it, such as fetching config over HTTP
  const trustedExplicit = lastDefined(
    trustedRules.map((rule) => rule.allowInternal),
  );
  const trustedScoped = lastDefined(
    scopedRules(trustedRules).map((rule) => rule.allowInternal),
  );
  // derived from the resolved values, so an admin masking a broad `allowInternal: false` of their own with a narrower `true` is not a veto
  const adminVeto = trustedExplicit === false || trustedScoped === false;
  // a vetoed request has no inherit tier left to fall through to, and is clamped to `false` rather than to undefined so that a consumer's `explicit ?? implicit` still short-circuits
  const inheritedExplicit = adminVeto
    ? false
    : lastDefined(inheritedRules.map((rule) => rule.allowInternal));
  const inheritedScoped = adminVeto
    ? false
    : lastDefined(
        scopedRules(inheritedRules).map((rule) => rule.allowInternal),
      );
  const internalHostGrant: InternalHostGrant = {
    explicit: trustedExplicit ?? inheritedExplicit,
    scoped: trustedScoped ?? inheritedScoped,
    implicit:
      !adminVeto &&
      [...trustedRules, ...inheritedRules].some((rule) =>
        isNonEmptyString(rule.matchHost),
      ),
  };
  if (
    !isUndefined(internalHostGrant.explicit) ||
    !isUndefined(internalHostGrant.scoped) ||
    internalHostGrant.implicit
  ) {
    res.internalHostGrant = internalHostGrant;
  }

  delete res.hostType;
  delete res.resolvedHost;
  delete res.matchHost;
  delete res.readOnly;
  delete res.trustTier;
  delete res.trusted;
  delete res.allowInternal;
  return res;
}

// the functions below leave out the rules registered by `detachUrlCredentials()`, which apply only to the requests `find()` is searched for

export function hosts({ hostType }: { hostType: string }): string[] {
  return configuredRules()
    .filter((rule) => rule.hostType === hostType)
    .map((rule) => rule.resolvedHost)
    .filter(isTruthy);
}

export function hostType({ url }: { url: string }): string | null {
  return (
    configuredRules()
      .filter((rule) => rule.matchHost && matchesHost(url, rule.matchHost))
      .sort(fromShorterToLongerMatchHost)
      .map((rule) => rule.hostType)
      .filter(isTruthy)
      .pop() ?? null
  );
}

export function findAll({ hostType }: { hostType: string }): HostRule[] {
  return configuredRules().filter((rule) => rule.hostType === hostType);
}

/**
 * @returns a deep copy of all host rules other than those registered by {@link detachUrlCredentials}
 */
export function getAll(): HostRule[] {
  return clone(configuredRules());
}

export function clear(): void {
  logger.debug('Clearing hostRules');
  hostRules = [];
  detachedCredentials = [];
  detachedRules = new WeakSet();
  sanitize.clearRepoSanitizedSecretsList();
}
