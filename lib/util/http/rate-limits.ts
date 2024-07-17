import is from '@sindresorhus/is';
import { matchesHost } from '../host-rules';
import * as hostRules from '../host-rules';
import type { RateLimitRule } from './types';

const defaults: RateLimitRule[] = [
  {
    matchHost: 'rubygems.org',
    throttleMs: 125,
  },
  {
    matchHost: 'https://crates.io/api/',
    throttleMs: 1000,
  },
];

export function getConcurrentRequestsLimit(url: string): number | null {
  let result: number | null = null;

  const { concurrentRequestLimit: hostRuleLimit } = hostRules.find({ url });
  if (
    is.number(hostRuleLimit) &&
    hostRuleLimit > 0 &&
    hostRuleLimit < Number.MAX_SAFE_INTEGER
  ) {
    result = hostRuleLimit;
  }

  for (const { matchHost, concurrency: limit } of defaults) {
    if (!matchesHost(url, matchHost)) {
      continue;
    }

    if (!is.number(limit)) {
      continue;
    }

    if (result && result <= limit) {
      continue;
    }

    result = limit;
  }

  return result;
}

export function getThrottleIntervalMs(url: string): number | null {
  let result: number | null = null;

  const { maxRequestsPerSecond } = hostRules.find({ url });
  if (is.number(maxRequestsPerSecond) && maxRequestsPerSecond > 0) {
    result = Math.ceil(1000 / maxRequestsPerSecond);
  }

  for (const { matchHost, throttleMs: limit } of defaults) {
    if (!matchesHost(url, matchHost)) {
      continue;
    }

    if (!is.number(limit)) {
      continue;
    }

    if (result && result >= limit) {
      continue;
    }

    result = limit;
  }

  return result;
}
