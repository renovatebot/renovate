import { logger } from '../../logger';

export enum Limit {
  Commits = 'Commits',
  PullRequests = 'PullRequests',
}

interface LimitValue {
  max: number | null;
  current: number;
}

const limits = new Map<Limit, LimitValue>();

export function resetAllLimits(): void {
  limits.clear();
}

export function setMaxLimit(key: Limit, max: unknown, allowZero = false): void {
  if (typeof max === 'number') {
    const maxVal = max > 0 || (allowZero && max <= 0) ? Math.max(max, 0) : null;
    logger.debug(`${key} limit = ${maxVal}`);
    limits.set(key, {
      current: 0,
      max: maxVal,
    });
  }
}

export function incLimitedValue(key: Limit, incBy = 1): void {
  const limit = limits.get(key) || { max: null, current: 0 };
  limits.set(key, {
    ...limit,
    current: limit.current + incBy,
  });
}

export function isLimitReached(key: Limit): boolean {
  const limit = limits.get(key);
  if (!limit || limit.max === null) {
    return false;
  }
  const { max, current } = limit;
  return max - current <= 0;
}
