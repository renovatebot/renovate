import is from '@sindresorhus/is';
import { matchesHost } from '../host-rules';
import type { RateLimitRule } from './types';

const defaultLimits: RateLimitRule[] = [
  {
    matchHost: 'rubygems.org',
    throttleIntervalMs: 125,
  },
  {
    matchHost: 'https://crates.io/api/',
    throttleIntervalMs: 1000,
  },
];

export function getDefaultThrottleIntervalMs(url: string): number | null {
  for (const rule of defaultLimits) {
    if (
      matchesHost(url, rule.matchHost) &&
      is.number(rule.throttleIntervalMs)
    ) {
      return rule.throttleIntervalMs;
    }
  }

  return null;
}

export function getDefaultConcurrentRequestsLimit(url: string): number | null {
  for (const rule of defaultLimits) {
    if (
      matchesHost(url, rule.matchHost) &&
      is.number(rule.maxConcurrentRequests)
    ) {
      return rule.maxConcurrentRequests;
    }
  }

  return null;
}
