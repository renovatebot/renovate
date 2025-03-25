import is from '@sindresorhus/is';
import { DateTime } from 'luxon';
import ms from 'ms';
import { logger } from '../logger';
import { regEx } from './regex';

const splitRegex = regEx(/(.*?[a-z]+)/);

function split(time: string): string[] {
  return time
    .split(splitRegex)
    .map((x) => x.trim())
    .filter(is.nonEmptyString);
}

function applyCustomFormat(spec: string): ms.StringValue {
  const monthRegex = regEx(/^(\d+)\s*(?:months?|M)$/);
  return spec.replace(
    monthRegex,
    (_, months) => `${months * 30} days`,
  ) as ms.StringValue;
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

const rangeRegex = regEx(/^(?<operator>(>=|<=|<|>))\s*(?<age>.*)$/);

export function satisfiesDateRange(
  date: string,
  range: string,
): boolean | null {
  const grps = range.trim().match(rangeRegex)?.groups;
  if (!grps) {
    return null;
  }

  const { operator, age } = grps;
  const luxonDate = DateTime.fromISO(date, { zone: 'utc' });
  if (!luxonDate.isValid) {
    logger.trace(`Invalid date when computing satisfiesDateRange: '${date}'`);
    return null;
  }

  const dateMs = luxonDate.toMillis();
  const ageMs = toMs(age);
  if (!is.number(ageMs)) {
    return null;
  }

  const rangeMs = Date.now() - ageMs;

  switch (operator) {
    case '>':
      return dateMs < rangeMs;
    case '>=':
      return dateMs <= rangeMs;
    case '<':
      return dateMs > rangeMs;
    case '<=':
      return dateMs >= rangeMs;
    // istanbul ignore next: can never happen
    default:
      return dateMs === rangeMs;
  }
}
