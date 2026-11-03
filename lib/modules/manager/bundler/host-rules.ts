import type { HostRule } from '../../../types/index.ts';
import { findAll } from '../../../util/host-rules.ts';

function hasCredentials(rule: HostRule): boolean {
  const hasBasicAuth = !!rule.username && !!rule.password;
  return hasBasicAuth || !!rule.token;
}

function isAuthenticatable(rule: HostRule): boolean {
  return !!rule.resolvedHost && hasCredentials(rule);
}

export function findAllAuthenticatable({
  hostType,
}: {
  hostType: string;
}): HostRule[] {
  return findAll({ hostType }).filter(isAuthenticatable);
}

export function getAuthenticationHeaderValue(hostRule: HostRule): string {
  if (hostRule.username) {
    const username = encodeURIComponent(hostRule.username);
    // TODO: types (#22198)
    return `${username}:${hostRule.password!}`;
  }

  // TODO: types (#22198)
  return `${hostRule.token!}`;
}
