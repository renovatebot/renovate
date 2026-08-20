import { isFalsy, isString, isTruthy, isUndefined } from '@sindresorhus/is';
import { GlobalConfig } from '../config/global.ts';
import { logger } from '../logger/index.ts';
import type { CombinedHostRule, HostRule } from '../types/index.ts';
import { clone } from './clone.ts';
import * as sanitize from './sanitize.ts';
import { toBase64 } from './string.ts';
import { matchRegexOrGlobList } from './string-match.ts';
import { isHttpUrl, massageHostUrl, parseUrl } from './url.ts';

let hostRules: HostRule[] = [];

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
 * `headers` are merged key by key across matching host rules (see {@link find}), so an admin's headers for a host survive even when a repo or preset rule also sets `headers` for the same host. Where both set the same header name, the more specific rule - or, when equally specific, the later-registered one - wins, which is the same precedence model `filterAllowedEnv` uses for `env`.
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
    return { ...rule, headers: allowed };
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
}

export function add(params: HostRule, options?: AddHostRuleOptions): void {
  let rule = migrateRule(params);

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

export function find(search: HostRuleSearch): CombinedHostRule {
  if ([search.hostType, search.url].every(isFalsy)) {
    logger.warn({ search }, 'Invalid hostRules search');
    return {};
  }

  // Sort primarily by rank, and secondarily by matchHost length
  const sortedRules = hostRules.sort(fromLowerRankAndShorterMatchHost);

  const matchedRules: HostRule[] = [];
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

  const res: HostRule = Object.assign({}, ...matchedRules);

  // `headers` is merged key by key, so that a rule setting a header of its own does not discard the headers of the rules it is combined with - notably a self-hosted admin's, which are registered before a repository's or a preset's
  // This is deliberately scoped to `headers` alone, as combining any more of the fields than we already do has caused authentication regressions before: an inherited `token` and a specific rule's `username`/`password` are not meant to be used together
  const matchedHeaders = matchedRules
    .map((rule) => rule.headers)
    .filter(isTruthy);
  if (matchedHeaders.length) {
    res.headers = Object.assign({}, ...matchedHeaders);
  }

  delete res.hostType;
  delete res.resolvedHost;
  delete res.matchHost;
  delete res.readOnly;
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
