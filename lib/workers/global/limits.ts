import { logger } from '../../logger';

const limitsToInit = ['prCommitsPerRunLimit'];
const l: Record<string, number> = {};
const v: Record<string, number> = {};

export function init(config: Record<string, any>) {
  let i;
  for (i = 0; i < limitsToInit.length; i += 1) {
    if (config[limitsToInit[i]]) {
      setLimit(limitsToInit[i], config[limitsToInit[i]]);
      v[limitsToInit[i]] = 0;
    } else {
      logger.debug(
        `Limits.init ${limitsToInit[i]} variable is not set. Ignoring ${limitsToInit[i]}`
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

export function incrementLimit(name: string, value: number = 1) {
  if (typeof v[name] !== 'undefined') {
    v[name] += value;
  }
}

