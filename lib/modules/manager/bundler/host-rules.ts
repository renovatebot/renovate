import type { HostRule } from '../../../types';
import { findAll } from '../../../util/host-rules';

function isAuthenticatable(rule: HostRule): boolean {
  return (
    !!rule.resolvedHost &&
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

export function getAuthenticationHeaderValue(hostRule: HostRule): string {
  if (hostRule.username) {
    // TODO: types (#7154)
    return `${hostRule.username}:${hostRule.password!}`;
  }

  // TODO: types (#7154)
  return `${hostRule.token!}`;
}
