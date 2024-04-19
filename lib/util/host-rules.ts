import is from '@sindresorhus/is';
import merge from 'deepmerge';
import type { SetRequired } from 'type-fest';
import { logger } from '../logger';
import type { CombinedHostRule, HostRule } from '../types';
import { clone } from './clone';
import * as sanitize from './sanitize';
import { toBase64 } from './string';
import { isHttpUrl, parseUrl } from './url';

let hostRules: HostRule[] = [];

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
  const hostValues = [matchHost, hostName, domainName, baseUrl].filter(Boolean);
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

export function add(params: HostRule): void {
  const rule = migrateRule(params);

  const confidentialFields: (keyof HostRule)[] = ['password', 'token'];
  if (rule.matchHost) {
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
    if (is.string(secret) && secret.length > 3) {
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
}

function isEmpty(
  rule: HostRule,
): rule is Omit<HostRule, 'hostType' | 'matchHost' | 'resolvedHost'> {
  return !rule.hostType && !rule.resolvedHost;
}

function isComplete(
  rule: HostRule,
): rule is SetRequired<HostRule, 'hostType' | 'matchHost' | 'resolvedHost'> {
  return !!rule.hostType && !!rule.resolvedHost;
}

function isOnlyHostType(
  rule: HostRule,
): rule is Omit<
  SetRequired<HostRule, 'hostType'>,
  'matchHost' | 'resolvedHost'
> {
  return !!rule.hostType && !rule.resolvedHost;
}

function isOnlyMatchHost(
  rule: HostRule,
): rule is Omit<
  SetRequired<HostRule, 'matchHost' | 'resolvedHost'>,
  'hostType'
> {
  return !rule.hostType && !!rule.matchHost;
}

function matchesHost(url: string, matchHost: string): boolean {
  if (isHttpUrl(url) && isHttpUrl(matchHost)) {
    return url.startsWith(matchHost);
  }

  const parsedUrl = parseUrl(url);
  if (!parsedUrl) {
    return false;
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

function prioritizeLongestMatchHost(rule1: HostRule, rule2: HostRule): number {
  // istanbul ignore if: won't happen in practice
  if (!rule1.matchHost || !rule2.matchHost) {
    return 0;
  }
  return rule1.matchHost.length - rule2.matchHost.length;
}

export function find(search: HostRuleSearch): CombinedHostRule {
  if (!(!!search.hostType || search.url)) {
    logger.warn({ search }, 'Invalid hostRules search');
    return {};
  }
  let res: HostRule = {};
  // First, apply empty rule matches
  hostRules
    .filter((rule) => isEmpty(rule))
    .forEach((rule) => {
      res = merge(res, rule);
    });
  // Next, find hostType-only matches
  hostRules
    .filter((rule) => isOnlyHostType(rule) && rule.hostType === search.hostType)
    .forEach((rule) => {
      res = merge(res, rule);
    });
  hostRules
    .filter(
      (rule) =>
        isOnlyMatchHost(rule) &&
        search.url &&
        matchesHost(search.url, rule.matchHost),
    )
    .sort(prioritizeLongestMatchHost)
    .forEach((rule) => {
      res = merge(res, rule);
    });
  // Finally, find combination matches
  hostRules
    .filter(
      (rule) =>
        isComplete(rule) &&
        rule.hostType === search.hostType &&
        search.url &&
        matchesHost(search.url, rule.matchHost),
    )
    .sort(prioritizeLongestMatchHost)
    .forEach((rule) => {
      res = merge(res, rule);
    });
  delete res.hostType;
  delete res.resolvedHost;
  delete res.matchHost;
  return res;
}

export function hosts({ hostType }: { hostType: string }): string[] {
  return hostRules
    .filter((rule) => rule.hostType === hostType)
    .map((rule) => rule.resolvedHost)
    .filter(is.truthy);
}

export function hostType({ url }: { url: string }): string | null {
  return (
    hostRules
      .filter((rule) => rule.matchHost && matchesHost(url, rule.matchHost))
      .sort(prioritizeLongestMatchHost)
      .map((rule) => rule.hostType)
      .filter(is.truthy)
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
