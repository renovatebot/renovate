import merge from 'deepmerge';
import { logger } from '../logger';
import { HostRule } from '../types';
import { clone } from './clone';
import * as sanitize from './sanitize';
import { parseUrl, validateUrl } from './url';

let hostRules: HostRule[] = [];

const legacyHostFields = ['hostName', 'domainName', 'baseUrl'];

export function add(params: HostRule): void {
  const rule = clone(params);
  const matchedFields = legacyHostFields.filter((field) => rule[field]);
  if (matchedFields.length) {
    logger.warn(
      `Legacy hostRules fields ${matchedFields.join(
        '+'
      )} should be migrated to "matchHost"`
    );
    if (rule.matchHost || matchedFields.length > 1) {
      matchedFields.push('matchHost');
      throw new Error(
        `hostRules cannot contain more than one host-matching field - use "matchHost" only. Found: [${matchedFields.join(
          ', '
        )}]`
      );
    }
    rule.matchHost = rule[matchedFields[0]];
    delete rule[matchedFields[0]];
  }

  const confidentialFields = ['password', 'token'];
  if (rule.matchHost) {
    const parsedUrl = parseUrl(rule.matchHost);
    rule.resolvedHost = parsedUrl?.hostname || rule.matchHost;
    confidentialFields.forEach((field) => {
      if (rule[field]) {
        logger.debug(
          `Adding ${field} authentication for ${rule.matchHost} to hostRules`
        );
      }
    });
  }
  confidentialFields.forEach((field) => {
    const secret = rule[field];
    if (secret && secret.length > 3) {
      sanitize.add(secret);
    }
  });
  if (rule.username && rule.password) {
    const secret = Buffer.from(`${rule.username}:${rule.password}`).toString(
      'base64'
    );
    sanitize.add(secret);
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
  return rule.hostType && !rule.resolvedHost;
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

function matchesHost(rule: HostRule, search: HostRuleSearch): boolean {
  if (validateUrl(rule.matchHost)) {
    return search.url.startsWith(rule.matchHost);
  }
  const parsedUrl = parseUrl(search.url);
  if (!parsedUrl?.hostname) {
    return false;
  }
  const { hostname } = parsedUrl;
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
        matchesHost(rule, search)
    )
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
