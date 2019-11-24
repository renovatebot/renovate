import { logger } from '../../logger';

const limitsToInit = ['prCommitsPerRunLimit'];
const l: Record<string, number> = {};
const v: Record<string, number> = {};

export function setLimit(name: string, value: number): void {
  logger.debug(`Limits.setLimit l[${name}] = ${value}`);
  l[name] = value;
}

export function init(config: Record<string, any>): void {
  logger.debug(`Limits.init enter method`);
  for (const limit of limitsToInit) {
    logger.debug(`Limits.init ${limit} processing`);
    if (config[limit]) {
      setLimit(limit, config[limit]);
      v[limit] = 0;
    } else {
      logger.debug(
        `Limits.init ${limit} variable is not set. Ignoring ${limit}`
      );
    }
  }
}

export function getLimitRemaining(name: string): number {
  let result;
  if (typeof v[name] !== 'undefined') {
    result = l[name] - v[name];
  } else {
    result = undefined;
  }
  return result;
}

export function incrementLimit(name: string, value = 1): void {
  if (typeof v[name] !== 'undefined') {
    v[name] += value;
  }
}
