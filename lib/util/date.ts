import { DateTime } from 'luxon';

const ONE_MINUTE_MS = 60 * 1000;

export function getElapsedDays(timestamp: string): number {
  const currentVersionTimestampDate = DateTime.fromISO(timestamp);
  const now = DateTime.now();
  const diffInDays = now.diff(currentVersionTimestampDate, 'days').as('days');
  const ageInDays = Math.floor(diffInDays);
  return ageInDays;
}

export function getElapsedMinutes(date: Date): number {
  return Math.floor((new Date().getTime() - date.getTime()) / ONE_MINUTE_MS);
}

export function getElapsedHours(date: Date | string): number {
  const pastDate =
    typeof date === 'string'
      ? DateTime.fromISO(date)
      : DateTime.fromJSDate(date);

  if (!pastDate.isValid) {
    return 0;
  }

  const diff = DateTime.now().diff(pastDate, 'hours');
  return Math.floor(diff.hours);
}

export function getElapsedMs(timestamp: string): number {
  return new Date().getTime() - new Date(timestamp).getTime();
}
