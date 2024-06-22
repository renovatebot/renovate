import { logger } from '../../logger';

export type Limit = 'Commits' | 'PullRequests' | 'Branches';

interface LimitValue {
  max: number | null;
  current: number;
}

const limits = new Map<Limit, LimitValue>();

export function resetAllLimits(): void {
  limits.clear();
}

export function setMaxLimit(key: Limit, val: unknown): void {
  const max = typeof val === 'number' ? Math.max(0, val) : null;
  limits.set(key, { current: 0, max });
  logger.debug(`${key} limit = ${max!}`);
}

export function incLimitedValue(key: Limit, incBy = 1): void {
  const limit = limits.get(key) ?? { max: null, current: 0 };
  limits.set(key, {
    ...limit,
    current: limit.current + incBy,
  });
}

export function isLimitReached(key: Limit): boolean {
  const limit = limits.get(key);
  // TODO: fix me?
  // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
  if (!limit || limit.max === null) {
    return false;
  }
  const { max, current } = limit;
  return max - current <= 0;
}
