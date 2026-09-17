import type { HostRule } from '../../../types/index.ts';
import { findAllForHostType, resolveAuth } from '../../../util/host-rules.ts';

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
  return findAllForHostType(hostType).filter(isAuthenticatable);
}

export function getAuthenticationHeaderValue(hostRule: HostRule): string {
  // `isAuthenticatable` has already established that the rule carries one of the two
  // TODO: types (#22198)
  const auth = resolveAuth(hostRule)!;

  if (auth.type === 'basic') {
    // bundler splits the value on the first `:`, so only the user half is percent-encoded and the password is passed through as configured
    return `${encodeURIComponent(auth.username ?? '')}:${auth.password}`;
  }

  return auth.token;
}
