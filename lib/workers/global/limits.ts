import is from '@sindresorhus/is';
import { logger } from '../../logger';
import type { BranchConfig, BranchUpgradeConfig } from '../types';

export type Limit = 'Commits';
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

function handleCommitsLimit(): boolean {
  const limit = limits.get('Commits');
  // TODO: fix me?
  // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
  if (!limit || limit.max === null) {
    return false;
  }
  const { max, current } = limit;
  return max - current <= 0;
}

export type CountName = 'ConcurrentPRs' | 'HourlyPRs' | 'Branches';

type BranchLimitName =
  | 'branchConcurrentLimit'
  | 'prConcurrentLimit'
  | 'prHourlyLimit';

export const counts = new Map<CountName, number>();

export function setCount(key: CountName, val: number): void {
  const count = val;
  counts.set(key, count);
  logger.debug(`${key} count = ${count}`);
}

export function incCountValue(key: CountName, incBy = 1): void {
  const count = counts.get(key) ?? 0;
  counts.set(key, count + incBy);
}

function handleConcurrentLimits(
  key: Exclude<CountName, 'HourlyPRs'>,
  config: BranchConfig,
): boolean {
  const limitKey =
    key === 'Branches' ? 'branchConcurrentLimit' : 'prConcurrentLimit';

  // calculate the limits for this branch
  const hourlyLimit = calcLimit(config.upgrades, 'prHourlyLimit');
  const limitValue = calcLimit(config.upgrades, limitKey);

  const hourlyPrCount =
    counts.get('HourlyPRs') ??
    // istanbul ignore next: should not happen
    0;
  const currentCount =
    counts.get(key) ??
    // istanbul ignore next: should not happen
    0;

  // if a limit is defined ( >0 ) and limit reached return true ie. limit has been reached
  if (hourlyLimit && hourlyPrCount >= hourlyLimit) {
    return true;
  }

  if (limitValue && currentCount >= limitValue) {
    return true;
  }

  return false;
}

export function calcLimit(
  upgrades: BranchUpgradeConfig[],
  limitName: BranchLimitName,
): number {
  logger.debug(
    {
      limits: upgrades.map((upg) => {
        return { depName: upg.depName, [limitName]: upg[limitName] };
      }),
    },
    `${limitName} of the upgrades present in this branch`,
  );

  if (hasMultipleLimits(upgrades, limitName)) {
    logger.once.debug(
      `Branch has multiple ${limitName} limits. The lowest among these will be selected.`,
    );
  }

  let lowestLimit = Number.MAX_SAFE_INTEGER;
  for (const upgrade of upgrades) {
    let limit = upgrade[limitName];

    // inherit prConcurrentLimit value incase branchConcurrentLimit is null
    if (!is.number(limit) && limitName === 'branchConcurrentLimit') {
      limit = upgrade.prConcurrentLimit;
    }

    // istanbul ignore if: should never happen as all limits get a default value
    if (is.undefined(limit)) {
      limit = Number.MAX_SAFE_INTEGER;
    }

    // no limit
    if (limit === 0 || limit === null) {
      logger.debug(
        `${limitName} of this branch is unlimited, because atleast one of the upgrade has it's ${limitName} set to "No limit" ie. 0 or null`,
      );
      return 0;
    }

    // limit is set
    lowestLimit = limit < lowestLimit ? limit : lowestLimit;
  }

  logger.debug(
    `Calculated lowest ${limitName} among the upgrades present in this branch is ${lowestLimit}.`,
  );
  return lowestLimit;
}

export function hasMultipleLimits(
  upgrades: BranchUpgradeConfig[],
  limitName: BranchLimitName,
): boolean {
  if (upgrades.length === 1) {
    return false;
  }

  const distinctLimits = new Set<number>();
  for (const upgrade of upgrades) {
    let limitValue = upgrade[limitName];

    // inherit prConcurrentLimit value incase branchConcurrentLimit is null
    if (limitName === 'branchConcurrentLimit' && !is.number(limitValue)) {
      limitValue = upgrade.prConcurrentLimit;
    }

    // istanbul ignore if: should not happen as the limits are of type number
    if (is.null_(limitValue)) {
      limitValue = 0;
    }

    if (!is.undefined(limitValue) && !distinctLimits.has(limitValue)) {
      distinctLimits.add(limitValue);
    }
  }

  return distinctLimits.size > 1;
}

export function isLimitReached(limit: 'Commits'): boolean;
export function isLimitReached(
  limit: 'Branches' | 'ConcurrentPRs',
  config: BranchConfig,
): boolean;
export function isLimitReached(
  limit: 'Commits' | 'Branches' | 'ConcurrentPRs',
  config?: BranchConfig,
): boolean {
  if (limit === 'Commits') {
    return handleCommitsLimit();
  }

  if (config) {
    return handleConcurrentLimits(limit, config);
  }

  // istanbul ignore next: should not happen
  throw new Error(
    'Config is required for computing limits for Branches and PullRequests',
  );
}
