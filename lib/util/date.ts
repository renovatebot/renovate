import { DateTime } from 'luxon';

const ONE_MINUTE_MS = 60 * 1000;
const ONE_DAY_MS = 24 * 60 * ONE_MINUTE_MS;

export function getElapsedDays(timestamp: string): number {
  const lastDate = new Date(timestamp).getTime(); // NaN if date is invalid
  if (!lastDate) {
    throw new Error();
  }

  return Math.floor((new Date().getTime() - lastDate) / ONE_DAY_MS);
}

export function getElapsedMinutes(date: Date): number {
  const lastDate = DateTime.fromJSDate(date);
  if (!lastDate.isValid) {
    throw new Error();
  }

  const diff = DateTime.now().diff(lastDate, 'minutes');
  return Math.floor(diff.minutes);
}

export function getElapsedHours(date: Date | string): number {
  const lastDate =
    typeof date === 'string'
      ? DateTime.fromISO(date)
      : DateTime.fromJSDate(date);

  if (!lastDate.isValid) {
    throw new Error();
  }

  const diff = DateTime.now().diff(lastDate, 'hours');
  return Math.floor(diff.hours);
}
