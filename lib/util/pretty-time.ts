import is from '@sindresorhus/is';
import ms from 'ms';
import { logger } from '../logger';
import { regEx } from './regex';
import { DateTime } from 'luxon';

const splitRegex = regEx(/(.*?[a-z]+)/);

function split(time: string): string[] {
  return time
    .split(splitRegex)
    .map((x) => x.trim())
    .filter(is.nonEmptyString);
}

function applyCustomFormat(spec: string): string {
  const monthRegex = regEx(/^(\d+)\s*(?:months?|M)$/);
  return spec.replace(monthRegex, (_, months) => `${months * 30} days`);
}

export function toMs(time: string): number | null {
  try {
    const specs = split(time).map(applyCustomFormat);
    if (!specs.length) {
      logger.debug({ time }, `Invalid time specifier: '${time}'`);
      return null;
    }

    let totalMillis = 0;
    for (const spec of specs) {
      const millis = ms(spec);
      if (!is.number(millis)) {
        logger.debug({ time }, `Invalid time specifier: '${spec}'`);
        return null;
      }
      totalMillis += millis;
    }
    return totalMillis;
  } catch (err) {
    logger.debug({ time, err }, `Invalid time specifier: '${time}'`);
    return null;
  }
}

const rangeRegex = regEx(/(?<operator>>|<|>=|<=)?\s*(?<age>.*)/);

export function satisfiesRange(date: string, range: string): boolean | null {
  const grps = range.trim().match(rangeRegex)?.groups;
  if (!grps) {
    return null;
  }
  const { operator, age } = grps;
  const dateMs =
    typeof date === 'string'
      ? DateTime.fromISO(date).toMillis()
      : DateTime.fromJSDate(date).toMillis();
  const ageMs = Date.now() - toMs(age)!;
  try {
    switch (operator) {
      case '>':
        return dateMs < ageMs;
      case '>=':
        return dateMs <= ageMs;
      case '<':
        return dateMs > ageMs;
      case '<=':
        return dateMs >= ageMs;
      default:
        return dateMs === ageMs;
    }
    return null;
  } catch (err) {
    return null;
  }
}
