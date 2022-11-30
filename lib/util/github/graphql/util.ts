import { DateTime, DurationLikeObject } from 'luxon';

/**
 * Tells whether the time `duration` is expired starting
 * from the `date` (ISO date format) at the moment of `now`.
 */
export function isDateExpired(
  currentTime: DateTime,
  initialTimestamp: string,
  duration: DurationLikeObject
): boolean {
  const expiryTime = DateTime.fromISO(initialTimestamp).plus(duration);
  return currentTime >= expiryTime;
}
