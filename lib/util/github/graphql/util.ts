import { DateTime, DurationLikeObject } from 'luxon';

export function prepareQuery(payloadQuery: string): string {
  return `
    query($owner: String!, $name: String!, $cursor: String, $count: Int!) {
      repository(owner: $owner, name: $name) {
        isRepoPrivate: isPrivate
        payload: ${payloadQuery}
      }
    }
  `;
}

/**
 * Tells whether the time `duration` is expired starting
 * from the `date` (ISO date format) at the moment of `now`.
 */
export function isDateExpired(
  currentTime: DateTime,
  initialTimestamp: string,
  duration: DurationLikeObject,
): boolean {
  const expiryTime = DateTime.fromISO(initialTimestamp).plus(duration).toUTC();
  return currentTime >= expiryTime;
}
