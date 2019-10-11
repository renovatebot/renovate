import { logger } from '../../logger';

const limitsToInit = ['prCommitsPerRunLimit'];
const l: Record<string, number> = {};
const v: Record<string, number> = {};

export function init(config: Record<string, any>) {
  for (const limit in limitsToInit) {
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

export function setLimit(name: string, value: number) {
  logger.debug(`Limits.setLimit l[${name}] = ${value}`);
  l[name] = value;
}

export function getLimitRemaining(name: string) {
  let result;
  if (typeof v[name] !== 'undefined') {
    result = l[name] - v[name];
  } else {
    result = undefined;
  }
  return result;
}

export function incrementLimit(name: string, value = 1) {
  if (typeof v[name] !== 'undefined') {
    v[name] += value;
  }
}
