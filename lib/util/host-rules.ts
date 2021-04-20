import URL from 'url';
import merge from 'deepmerge';
import { logger } from '../logger';
import { HostRule } from '../types';
import * as sanitize from './sanitize';

let hostRules: HostRule[] = [];

export function add(params: HostRule): void {
  if (params.domainName && params.hostName) {
    throw new Error('hostRules cannot contain both a domainName and hostName');
  }
  if (params.domainName && params.baseUrl) {
    throw new Error('hostRules cannot contain both a domainName and baseUrl');
  }
  if (params.hostName && params.baseUrl) {
    throw new Error('hostRules cannot contain both a hostName and baseUrl');
  }
  hostRules.push(params);
  const confidentialFields = ['password', 'token'];
  const ruleMatch = params.baseUrl || params.hostName || params.domainName;
  if (ruleMatch) {
    confidentialFields.forEach((field) => {
      if (params[field]) {
        logger.debug(
          `Adding ${field} authentication for ${ruleMatch} to hostRules`
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
}

export interface HostRuleSearch {
  hostType?: string;
  url?: string;
}

function isEmptyRule(rule: HostRule): boolean {
  return !rule.hostType && !rule.domainName && !rule.hostName && !rule.baseUrl;
}

function isHostTypeRule(rule: HostRule): boolean {
  return rule.hostType && !rule.domainName && !rule.hostName && !rule.baseUrl;
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

function isMultiRule(rule: HostRule): boolean {
  return rule.hostType && !!(rule.domainName || rule.hostName || rule.baseUrl);
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
  // Finally, find combination matches
  hostRules
    .filter(
      (rule) =>
        isMultiRule(rule) &&
        matchesHostType(rule, search) &&
        (matchesDomainName(rule, search) ||
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
