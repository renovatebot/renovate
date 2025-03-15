import is from '@sindresorhus/is';
import { logger } from '../logger';
import type { CombinedHostRule, HostRule } from '../types';
import { clone } from './clone';
import * as sanitize from './sanitize';
import { toBase64 } from './string';
import { isHttpUrl, massageHostUrl, parseUrl } from './url';

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
  readOnly?: boolean;
}

export function matchesHost(url: string, matchHost: string): boolean {
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

export function find(search: HostRuleSearch): CombinedHostRule {
  if ([search.hostType, search.url].every(is.falsy)) {
    logger.warn({ search }, 'Invalid hostRules search');
    return {};
  }

  // Sort primarily by rank, and secondarily by matchHost length
  const sortedRules = hostRules
    .sort(fromShorterToLongerMatchHost)
    .sort(fromLowerToHigherRank);

  const matchedRules: HostRule[] = [];
  for (const rule of sortedRules) {
    let hostTypeMatch = true;
    let hostMatch = true;
    let readOnlyMatch = true;

    if (rule.hostType) {
      hostTypeMatch = false;
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

    if (!is.undefined(rule.readOnly)) {
      readOnlyMatch = false;
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
    .filter(is.truthy);
}

export function hostType({ url }: { url: string }): string | null {
  return (
    hostRules
      .filter((rule) => rule.matchHost && matchesHost(url, rule.matchHost))
      .sort(fromShorterToLongerMatchHost)
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
