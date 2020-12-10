import { logger } from '../../logger';

export enum Limit {
  Commits = 'Commits',
}

interface LimitValue {
  max: number | null;
  current: number;
}

const limits = new Map<Limit, LimitValue>();

export function resetAllLimits(): void {
  limits.clear();
}

export function setMaxLimit(key: Limit, max: unknown): void {
  if (max === null || typeof max === 'number') {
    limits.set(key, {
      current: 0,
      max: typeof max === 'number' ? Math.max(0, max) : null,
    });
    logger.debug(`${key} limit = ${max}`);
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
