import { logger } from '../../logger';

const limitsToInit = ['prCommitsPerRunLimit'];
const l = {};
const v = {};

export function init() {
  let i;
  for (i = 0; i < limitsToInit.length; i += 1) {
    if (process.env[limitsToInit[i]]) {
      setLimit(limitsToInit[i], parseInt(process.env[limitsToInit[i]], 10));
      v[limitsToInit[i]] = 0;
    } else {
      logger.info(
        `4279 feat - Limits.init ${limitsToInit[i]} environment variable is not set. Ignoring ${limitsToInit[i]}`
      );
    }
  }
}

export function setLimit(name: string, value: number) {
  logger.info(`4279 feat - Limits.setLimit h[${name}] = ${value}`);
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

export function incrementLimit(name: string, value: number) {
  if (typeof v[name] !== 'undefined') {
    v[name] += value;
  }
}
