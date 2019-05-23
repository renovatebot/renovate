import URL from 'url';

export interface HostRule {
  hostType?: string;
  hostName?: string;
  baseUrl?: string;
  token?: string;
  username?: string;
  password?: string;
}

let hostRules: HostRule[] = [];

export function add(params: HostRule) {
  if (!(params.hostType || params.hostName || params.baseUrl)) {
    throw new Error('hostRules must contain a hostType, hostName or baseUrl');
  }
  if (params.hostName && params.baseUrl) {
    throw new Error('hostRules cannot contain both a hostName and baseUrl');
  }
  hostRules.push(params);
}

export interface HostRuleSearch {
  hostType?: string;
  url: string;
}

function isHostTypeRule(rule: HostRule) {
  return rule.hostType && !rule.hostName && !rule.baseUrl;
}

function matchesHostType(rule: HostRule, search: HostRuleSearch) {
  return search.hostType && rule.hostType === search.hostType;
}

function isHostnameRule(rule: HostRule) {
  return rule.hostName && !(rule.hostType || rule.baseUrl);
}

function matchesHostName(rule: HostRule, search: HostRuleSearch) {
  return search.url && rule.hostName === URL.parse(search.url).hostname;
}

function isBaseUrlRule(rule: HostRule) {
  return rule.baseUrl && !rule.hostType;
}

function matchesBaseUrl(rule: HostRule, search: HostRuleSearch) {
  return search.url && rule.baseUrl && search.url.startsWith(rule.baseUrl);
}

export function find(search: HostRuleSearch) {
  if (!(search.hostType || search.url)) {
    logger.warn({ search }, 'Invalid hostRules search');
    return null;
  }
  let res = {} as HostRule;
  // First, find hostType-only matches
  hostRules
    .filter(rule => isHostTypeRule(rule) && matchesHostType(rule, search))
    .forEach(rule => {
      res = merge(res, rule);
    });
  // Next, find hostName-only matches
  hostRules
    .filter(rule => isHostnameRule(rule) && matchesHostName(rule, search))
    .forEach(rule => {
      res = merge(res, rule);
    });
  // Next, find baseUrl-only matches
  hostRules
    .filter(rule => isBaseUrlRule(rule) && matchesBaseUrl(rule, search))
    .forEach(rule => {
      res = merge(res, rule);
    });
  // Finally, find combination matches
  hostRules
    .filter(
      rule =>
        matchesHostType(rule, search) &&
        (matchesHostName(rule, search) || matchesBaseUrl(rule, search))
    )
    .forEach(rule => {
      res = merge(res, rule);
    });
  delete res.hostType;
  delete res.hostName;
  delete res.baseUrl;
  return res;
}

export function hosts({ hostType }: { hostType: string }) {
  return hostRules
    .filter(rule => rule.hostType === hostType)
    .map(rule => {
      if (rule.hostName) return rule.hostName;
      if (rule.baseUrl) return URL.parse(rule.baseUrl).hostname;
      return null;
    })
    .filter(Boolean);
}

export function clear() {
  hostRules = [];
}

function merge(existing: HostRule, additional: HostRule) {
  const locals = { ...additional } as HostRule;
  Object.keys(locals).forEach(key => {
    if (locals[key] === undefined || locals[key] === null) {
      delete locals[key];
    }
  });
  return { ...existing, ...locals };
}
