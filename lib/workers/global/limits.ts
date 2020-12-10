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

export function setMaxLimit(
  key: Limit,
  val: unknown,
  allowUnlimited = true
): void {
  if (typeof val === 'number') {
    const current = 0;
    let max: number = null;
    if (allowUnlimited) {
      if (val > 0) {
        max = val;
      }
    } else {
      max = Math.max(0, val);
    }
    limits.set(key, { current, max });
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
