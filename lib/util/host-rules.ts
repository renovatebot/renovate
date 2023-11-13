import is from '@sindresorhus/is';
import merge from 'deepmerge';
import { logger } from '../logger';
import type { HostRule, HostRuleSearchResult } from '../types';
import { clone } from './clone';
import * as sanitize from './sanitize';
import { toBase64 } from './string';
import { parseUrl, validateUrl } from './url';

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

function isEmptyRule(rule: HostRule): boolean {
  return !rule.hostType && !rule.resolvedHost;
}

function isHostTypeRule(rule: HostRule): boolean {
  return !!rule.hostType && !rule.resolvedHost;
}

function isHostOnlyRule(rule: HostRule): boolean {
  return !rule.hostType && !!rule.matchHost;
}

function isMultiRule(rule: HostRule): boolean {
  return !!rule.hostType && !!rule.resolvedHost;
}

function matchesHostType(rule: HostRule, search: HostRuleSearch): boolean {
  return rule.hostType === search.hostType;
}

function matchesHost(rule: HostRule, search: HostRuleSearch): boolean {
  // istanbul ignore if
  if (!rule.matchHost) {
    return false;
  }
  if (search.url && validateUrl(rule.matchHost)) {
    return search.url.startsWith(rule.matchHost);
  }
  const parsedUrl = search.url ? parseUrl(search.url) : null;
  if (!parsedUrl?.hostname) {
    return false;
  }
  const { hostname } = parsedUrl;
  const dotPrefixedMatchHost = rule.matchHost.startsWith('.')
    ? rule.matchHost
    : `.${rule.matchHost}`;
  return hostname === rule.matchHost || hostname.endsWith(dotPrefixedMatchHost);
}

function prioritizeLongestMatchHost(rule1: HostRule, rule2: HostRule): number {
  // istanbul ignore if: won't happen in practice
  if (!rule1.matchHost || !rule2.matchHost) {
    return 0;
  }
  return rule1.matchHost.length - rule2.matchHost.length;
}

export function find(search: HostRuleSearch): HostRuleSearchResult {
  if (!(!!search.hostType || search.url)) {
    logger.warn({ search }, 'Invalid hostRules search');
    return {};
  }
  let res: HostRule = {};
  // First, apply empty rule matches
  hostRules
    .filter((rule) => isEmptyRule(rule))
    .forEach((rule) => {
      res = merge(res, rule);
    });
  // Next, find hostType-only matches
  hostRules
    .filter((rule) => isHostTypeRule(rule) && matchesHostType(rule, search))
    .forEach((rule) => {
      res = merge(res, rule);
    });
  hostRules
    .filter((rule) => isHostOnlyRule(rule) && matchesHost(rule, search))
    .sort(prioritizeLongestMatchHost)
    .forEach((rule) => {
      res = merge(res, rule);
    });
  // Finally, find combination matches
  hostRules
    .filter(
      (rule) =>
        isMultiRule(rule) &&
        matchesHostType(rule, search) &&
        matchesHost(rule, search),
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
      .filter((rule) => matchesHost(rule, { url }))
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
