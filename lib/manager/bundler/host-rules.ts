import { HostRule } from '../../types';
import { findAll } from '../../util/host-rules';
import { parseUrl } from '../../util/url';

function isAuthenticatable(rule: HostRule): boolean {
  return (
    (!!rule.hostName || !!rule.domainName || !!rule.baseUrl) &&
    ((!!rule.username && !!rule.password) || !!rule.token)
  );
}

export function findAllAuthenticatable({
  hostType,
}: {
  hostType: string;
}): HostRule[] {
  return findAll({ hostType }).filter(isAuthenticatable);
}

export function getDomain(hostRule: HostRule): string {
  if (hostRule.hostName) {
    return hostRule.hostName;
  }
  if (hostRule.domainName) {
    return hostRule.domainName;
  }
  if (hostRule.baseUrl) {
    return parseUrl(hostRule.baseUrl).host;
  }

  return null;
}

export function getAuthenticationHeaderValue(hostRule: HostRule): string {
  if (hostRule.username) {
    return `${hostRule.username}:${hostRule.password}`;
  }

  return hostRule.token;
}
