import { logger } from '../../logger';

const limitsToInit = ['prCommitsPerRunLimit'];

const l = {};
const v = {};

export function init() {
  let i;
  for (i = 0; i < limitsToInit.length; i += 1) {
    if (process.env[limitsToInit[i]]) {
      logger.info(
        `4279 feat - Limits.init ${
          limitsToInit[i]
        } environment variable is set to ${process.env[limitsToInit[i]]}`
      );
      logger.info(
        `4279 feat - Limits.init ${limitsToInit[i]} = ${
          process.env[limitsToInit[i]]
        }`
      );
      setLimit(limitsToInit[i], parseInt(process.env[limitsToInit[i]], 10));
      v[limitsToInit[i]] = 0;
      logger.info(`4279 feat - Limits v[${limitsToInit[i]}] = 0`);
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
    logger.info(
      `4279 feat - Limits.getLimitRemaining for ${name} = ${l[name] - v[name]}`
    );
    result = l[name] - v[name];
  } else {
    result = undefined;
  }
  return result;
}

export function incrementLimit(name: string, value: number) {
  if (typeof v[name] !== 'undefined') {
    logger.info(
      `4279 feat - Limits.incrementLimit for ${name} by ${value} = ${v[name] +
        value}`
    );
    v[name] += value;
  }
}
