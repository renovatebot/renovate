import {
  isFalsy,
  isNonEmptyString,
  isString,
  isTruthy,
  isUndefined,
} from '@sindresorhus/is';
import { GlobalConfig } from '../config/global.ts';
import { logger } from '../logger/index.ts';
import type {
  CombinedHostRule,
  HostRule,
  InternalHostGrant,
} from '../types/index.ts';
import { clone } from './clone.ts';
import * as sanitize from './sanitize.ts';
import { toBase64 } from './string.ts';
import { matchRegexOrGlobList } from './string-match.ts';
import { isHttpUrl, massageHostUrl, parseUrl } from './url.ts';

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
}

let hostRules: RegisteredHostRule[] = [];

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
 * Loudly remove anything that's not permitted, logging a WARN.
 *
 * `add()` applies this to every rule it registers, so callers only need it themselves to pre-filter - e.g. to avoid repeating the WARN when the same rules are registered again and again.
 *
 * @param [allowedHeaders] the effective allowlist. Defaults to `GlobalConfig`, but must be passed explicitly when filtering before `GlobalConfig` reflects the repository being processed, i.e. for a `repositories[]` entry's own `allowedHeaders` override
 * @param [warnOnDenied=true] whether to log the WARN. Pass `false` where the very same rules are filtered again, so that it is logged once rather than repeated
 *
 * Headers that survive this allowlist are still subject to how {@link find} combines them: an admin's headers for a host are applied over those of any repository or preset rule matching the same request, so a repository can neither drop nor substitute them.
 */
export function filterAllowedHeaders(
  rules: HostRule[],
  allowedHeaders?: string[],
  warnOnDenied = true,
): HostRule[] {
  // `??`, rather than a parameter default: a default only applies to `undefined`, and a `null` can reach us from user config
  const allowlist = allowedHeaders ?? GlobalConfig.get('allowedHeaders');
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

  if (denied.length && warnOnDenied) {
    logger.warn(
      { denied },
      "Ignoring hostRules headers not permitted by this Renovate instance's `allowedHeaders`",
    );
  }
  return result;
}

export interface AddHostRuleOptions {
  /** the effective allowlist. Defaults to `GlobalConfig`; pass it explicitly when `GlobalConfig` does not yet reflect the repository the rule is registered for */
  allowedHeaders?: string[];

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

export function add(params: HostRule, options?: AddHostRuleOptions): void {
  let rule: RegisteredHostRule = {
    ...migrateRule(params),
    // set only from `options`, and assigned unconditionally so that it cannot be carried over from `params`: `HostRule` has no `trustTier` field, but configuration is parsed from JSON, so a repository could otherwise smuggle one in and have its rules treated as the administrator's
    trustTier: trustTierFor(options),
  };
  // as above, for the boolean this tier replaced
  delete rule.trusted;

  // like the trust tier, `allowInternal` may only come from configuration the administrator trusts: a repository or preset rule must not be able to grant itself access to internal hosts
  if (!isUndefined(rule.allowInternal) && rule.trustTier === 'untrusted') {
    logger.debug(
      `Ignoring hostRules allowInternal for ${rule.matchHost ?? rule.hostType} from untrusted config`,
    );
    delete rule.allowInternal;
  }

  if (rule.headers) {
    // enforced here, at the single registration chokepoint, so that no current or future caller can register a rule whose headers bypass `allowedHeaders`; `applyHostRule` filters by header name again at request time as defence in depth
    [rule] = filterAllowedHeaders([rule], options?.allowedHeaders);
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
  hostRules.push(rule);
}

export interface HostRuleSearch {
  hostType?: string;
  url?: string;
  readOnly?: boolean;
}

export function matchesHost(url: string, matchHost: string): boolean {
  const parsedUrl = parseUrl(url);
  if (!parsedUrl) {
    return false;
  }

  const parsedMatchHost = parseUrl(matchHost);
  if (isHttpUrl(parsedUrl) && isHttpUrl(parsedMatchHost)) {
    return parsedUrl.href.startsWith(parsedMatchHost!.href);
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

export function find(search: HostRuleSearch): CombinedHostRule {
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
      if (search.readOnly === rule.readOnly) {
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

export function hosts({ hostType }: { hostType: string }): string[] {
  return hostRules
    .filter((rule) => rule.hostType === hostType)
    .map((rule) => rule.resolvedHost)
    .filter(isTruthy);
}

export function hostType({ url }: { url: string }): string | null {
  return (
    hostRules
      .filter((rule) => rule.matchHost && matchesHost(url, rule.matchHost))
      .sort(fromShorterToLongerMatchHost)
      .map((rule) => rule.hostType)
      .filter(isTruthy)
      .pop() ?? null
  );
}

export function findAll({ hostType }: { hostType: string }): HostRule[] {
  return hostRules.filter((rule) => rule.hostType === hostType);
}

/**
 * @returns a deep copy of all known host rules without any filtering
 */
export function getAll(): HostRule[] {
  return clone(hostRules);
}

export function clear(): void {
  logger.debug('Clearing hostRules');
  hostRules = [];
  sanitize.clearRepoSanitizedSecretsList();
}
