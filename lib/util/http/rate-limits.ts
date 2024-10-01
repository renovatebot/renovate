import is from '@sindresorhus/is';
import { matchesHost } from '../host-rules';
import * as hostRules from '../host-rules';
import type { ConcurrencyLimitRule, ThrottleLimitRule } from './types';

// The first match wins
const concurrencyDefaults: ConcurrencyLimitRule[] = [
  {
    matchHost: 'registry.npmjs.org',
    concurrency: 999,
  },
  {
    matchHost: 'repology.org',
    concurrency: 1,
  },
  {
    matchHost: '*',
    concurrency: 16,
  },
];

// The first match wins
const throttleDefaults: ThrottleLimitRule[] = [
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
  {
    // The rate limit is 100 per second, according this comment:
    // https://github.com/renovatebot/renovate/discussions/27018#discussioncomment-10336270
    //
    // We stick to 20 per second just in case.
    matchHost: 'https://plugins.gradle.org',
    throttleMs: 50,
  },
  {
    matchHost: 'repology.org',
    throttleMs: 2000,
  },
];

let throttleLimits: ThrottleLimitRule[] = [];
let concurrencyLimits: ConcurrencyLimitRule[] = [];

export function setHttpRateLimits(
  concurrencyRules?: ConcurrencyLimitRule[],
  throttleRules?: ThrottleLimitRule[],
): void {
  concurrencyLimits = concurrencyRules ?? concurrencyDefaults;
  throttleLimits = throttleRules ?? throttleDefaults;
}

function matches(url: string, host: string): boolean {
  if (host === '*') {
    return true;
  }

  return matchesHost(url, host);
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

  for (const { matchHost, concurrency: limit } of concurrencyLimits) {
    if (!matches(url, matchHost)) {
      continue;
    }

    if (result && result <= limit) {
      continue;
    }

    result = limit;
    break;
  }

  return result;
}

export function getThrottleIntervalMs(url: string): number | null {
  let result: number | null = null;

  const { maxRequestsPerSecond } = hostRules.find({ url });
  if (is.number(maxRequestsPerSecond) && maxRequestsPerSecond > 0) {
    result = Math.ceil(1000 / maxRequestsPerSecond);
  }

  for (const { matchHost, throttleMs: limit } of throttleLimits) {
    if (!matches(url, matchHost)) {
      continue;
    }

    if (result && result >= limit) {
      continue;
    }

    result = limit;
    break;
  }

  return result;
}
