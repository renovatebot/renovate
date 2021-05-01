import URL from 'url';
import merge from 'deepmerge';
import { logger } from '../logger';
import { HostRule } from '../types';
import { clone } from './clone';
import * as sanitize from './sanitize';

let hostRules: HostRule[] = [];

const matchFields = ['matchHost', 'hostName', 'domainName', 'baseUrl'];

export function add(params: HostRule): void {
  const matchedFields = matchFields.filter((field) => params[field]);
  if (matchedFields.length > 1) {
    throw new Error(
      `hostRules cannot contain more than one host-matching field. Found: [${matchedFields.join(
        ', '
      )}]`
    );
  }
  const confidentialFields = ['password', 'token'];
  let resolvedHost =
    params.baseUrl || params.hostName || params.domainName || params.matchHost;
  if (resolvedHost) {
    resolvedHost = URL.parse(resolvedHost).hostname || resolvedHost;
    confidentialFields.forEach((field) => {
      if (params[field]) {
        logger.debug(
          `Adding ${field} authentication for ${resolvedHost} to hostRules`
        );
      }
    });
  }
  confidentialFields.forEach((field) => {
    const secret = params[field];
    if (secret && secret.length > 3) {
      sanitize.add(secret);
    }
  });
  if (params.username && params.password) {
    const secret = Buffer.from(
      `${params.username}:${params.password}`
    ).toString('base64');
    sanitize.add(secret);
  }
  const hostRule = clone(params);
  if (resolvedHost) {
    hostRule.resolvedHost = resolvedHost;
  }
  hostRules.push(hostRule);
}

export interface HostRuleSearch {
  hostType?: string;
  url?: string;
}

function isEmptyRule(rule: HostRule): boolean {
  return !rule.hostType && !rule.resolvedHost;
}

function isHostTypeRule(rule: HostRule): boolean {
  return rule.hostType && !rule.resolvedHost;
}

function isDomainNameRule(rule: HostRule): boolean {
  return !rule.hostType && !!rule.domainName;
}

function isHostNameRule(rule: HostRule): boolean {
  return !rule.hostType && !!rule.hostName;
}

function isBaseUrlRule(rule: HostRule): boolean {
  return !rule.hostType && !!rule.baseUrl;
}

function isHostOnlyRule(rule: HostRule): boolean {
  return !rule.hostType && !!rule.matchHost;
}

function isMultiRule(rule: HostRule): boolean {
  return rule.hostType && !!rule.resolvedHost;
}

function matchesHostType(rule: HostRule, search: HostRuleSearch): boolean {
  return rule.hostType === search.hostType;
}

function matchesDomainName(rule: HostRule, search: HostRuleSearch): boolean {
  const hostname = search.url && URL.parse(search.url).hostname;
  return (
    search.url &&
    rule.domainName &&
    hostname &&
    hostname.endsWith(rule.domainName)
  );
}

function matchesHostName(rule: HostRule, search: HostRuleSearch): boolean {
  return (
    search.url &&
    rule.hostName &&
    URL.parse(search.url).hostname === rule.hostName
  );
}

function matchesBaseUrl(rule: HostRule, search: HostRuleSearch): boolean {
  return search.url && rule.baseUrl && search.url.startsWith(rule.baseUrl);
}

const baseUrlTest = /^https?:\/\//;

function matchesHost(rule: HostRule, search: HostRuleSearch): boolean {
  if (!rule.matchHost) {
    return false;
  }
  if (baseUrlTest.test(rule.matchHost)) {
    return search.url.startsWith(rule.matchHost);
  }
  const { hostname } = URL.parse(search.url);
  if (!hostname) {
    return false;
  }
  return hostname === rule.matchHost || hostname.endsWith(`.${rule.matchHost}`);
}

export function find(search: HostRuleSearch): HostRule {
  if (!(search.hostType || search.url)) {
    logger.warn({ search }, 'Invalid hostRules search');
    return {};
  }
  let res = ({} as any) as HostRule;
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
  // Next, find domainName-only matches
  hostRules
    .filter((rule) => isDomainNameRule(rule) && matchesDomainName(rule, search))
    .forEach((rule) => {
      res = merge(res, rule);
    });
  // Next, find hostName-only matches
  hostRules
    .filter((rule) => isHostNameRule(rule) && matchesHostName(rule, search))
    .forEach((rule) => {
      res = merge(res, rule);
    });
  // Next, find baseUrl-only matches
  hostRules
    .filter((rule) => isBaseUrlRule(rule) && matchesBaseUrl(rule, search))
    .forEach((rule) => {
      res = merge(res, rule);
    });
  hostRules
    .filter((rule) => isHostOnlyRule(rule) && matchesHost(rule, search))
    .forEach((rule) => {
      res = merge(res, rule);
    });
  // Finally, find combination matches
  hostRules
    .filter(
      (rule) =>
        isMultiRule(rule) &&
        matchesHostType(rule, search) &&
        (matchesDomainName(rule, search) ||
          matchesHost(rule, search) ||
          matchesHostName(rule, search) ||
          matchesBaseUrl(rule, search))
    )
    .forEach((rule) => {
      res = merge(res, rule);
    });
  delete res.hostType;
  delete res.domainName;
  delete res.hostName;
  delete res.baseUrl;
  delete res.resolvedHost;
  delete res.matchHost;
  return res;
}

export function hosts({ hostType }: { hostType: string }): string[] {
  return hostRules
    .filter((rule) => rule.hostType === hostType)
    .map((rule) => {
      if (rule.hostName) {
        return rule.hostName;
      }
      if (rule.baseUrl) {
        return URL.parse(rule.baseUrl).hostname;
      }
      if (rule.matchHost) {
        if (baseUrlTest.test(rule.matchHost)) {
          return URL.parse(rule.matchHost).hostname;
        }
        return rule.matchHost;
      }
      return null;
    })
    .filter(Boolean);
}

export function findAll({ hostType }: { hostType: string }): HostRule[] {
  return hostRules.filter((rule) => rule.hostType === hostType);
}

export function clear(): void {
  logger.debug('Clearing hostRules');
  hostRules = [];
  sanitize.clear();
}
