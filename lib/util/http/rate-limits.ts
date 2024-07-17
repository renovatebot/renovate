import is from '@sindresorhus/is';
import { matchesHost } from '../host-rules';
import * as hostRules from '../host-rules';
import type { RateLimitRule } from './types';

const defaults: RateLimitRule[] = [
  {
    // https://guides.rubygems.org/rubygems-org-rate-limits/
    matchHost: 'rubygems.org',
    throttleMs: 125,
  },
  {
    // https://crates.io/data-access#api
    matchHost: 'https://crates.io/api/',
    throttleMs: 1000,
  },
];

let limits: RateLimitRule[] = [];

export function setHttpRateLimits(rules: RateLimitRule[] = defaults): void {
  limits = rules;
}

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

  for (const { matchHost, concurrency: limit } of limits) {
    if (!matchesHost(url, matchHost) || !is.number(limit)) {
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

  for (const { matchHost, throttleMs: limit } of limits) {
    if (!matchesHost(url, matchHost) || !is.number(limit)) {
      continue;
    }

    if (result && result >= limit) {
      continue;
    }

    result = limit;
  }

  return result;
}
