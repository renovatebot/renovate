import { DateTime } from 'luxon';

export type Timestamp = string & { __timestamp: never };

export function asTimestamp(input: unknown): Timestamp | null {
  if (input instanceof Date) {
    return input.toISOString() as Timestamp;
  }

  if (
    typeof input === 'number' &&
    !Number.isNaN(input) &&
    input > 0 &&
    input <= Date.now() + 24 * 60 * 60 * 1000 // ignore values from the future
  ) {
    return new Date(input).toISOString() as Timestamp;
  }

  if (typeof input === 'string') {
    /**
     * First, try to parse ISO format
     */
    const isoDate = DateTime.fromISO(input, { zone: 'UTC' });
    if (isoDate.isValid) {
      return isoDate.toISO() as Timestamp;
    }

    /**
     * Second, try to parse number-like dates,
     * which is useful for parsing dates from versions, e.g. `1.2.3-20250101120000`
     */
    const numberLikeDate = DateTime.fromFormat(input, 'yyyyMMddHHmmss', {
      zone: 'UTC',
    });
    if (numberLikeDate.isValid) {
      return numberLikeDate.toISO() as Timestamp;
    }

    /**
     * Third, parse with more permissive Date constructor.
     *
     * In order to avoid timezone issues,
     * here we ignore hours, minutes, seconds and milliseconds.
     */
    try {
      const fallbackDate = new Date(input);
      const year = fallbackDate.getUTCFullYear();
      const month = fallbackDate.getUTCMonth();
      const day = fallbackDate.getUTCDate();
      const utc = Date.UTC(year, month, day);
      return new Date(utc).toISOString() as Timestamp;
    } catch {
      return null;
    }
  }

  return null;
}
