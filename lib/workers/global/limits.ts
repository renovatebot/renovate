import { logger } from '../../logger';

const limitsToInit = ['prCommitsPerRunLimit'];
let l: Record<string, number> = {};
let v: Record<string, number> = {};

export function reset(): void {
  l = {};
  v = {};
}

export function setLimit(name: string, value: number): void {
  logger.debug(`Limits.setLimit l[${name}] = ${value}`);
  l[name] = value;
  v[name] = 0;
}

export function init(config: Record<string, any>): void {
  logger.debug(`Limits.init enter method`);
  for (const limit of limitsToInit) {
    logger.debug(`Limits.init ${limit} processing`);
    if (config[limit]) {
      setLimit(limit, config[limit]);
    } else {
      logger.debug(
        `Limits.init ${limit} variable is not set. Ignoring ${limit}`
      );
    }
  }
}

function getLimitRemaining(name: string): number | null {
  if (typeof l[name] !== 'undefined' && typeof v[name] !== 'undefined') {
    return l[name] - v[name];
  }
  return null;
}

export function isLimitReached(name: string): boolean {
  const remaining = getLimitRemaining(name);
  return remaining === null ? false : remaining <= 0;
}

export function incrementLimit(name: string, value = 1): void {
  if (typeof v[name] !== 'undefined') {
    v[name] += value;
  }
}
