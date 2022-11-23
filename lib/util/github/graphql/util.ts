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
  const initialTime = DateTime.fromISO(initialTimestamp);
  const expiryTime = initialTime.plus(duration);
  return currentTime >= expiryTime;
}
