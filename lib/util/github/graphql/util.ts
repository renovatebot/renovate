import type { DurationLikeObject } from 'luxon';
import { DateTime } from 'luxon';

/**
 * Wraps a payload query in the shared repository query.
 *
 * When `withRefQuery` is true, an optional `$query: String` variable is
 * declared so the payload may forward it to a `refs(query: $query)` argument.
 * Adapters that do not use it (releases, branches) omit the flag, keeping their
 * query shape unchanged.
 */
export function prepareQuery(
  payloadQuery: string,
  opts?: { withRefQuery?: boolean },
): string {
  const refQueryVar = opts?.withRefQuery ? ', $query: String' : '';
  return `
    query($owner: String!, $name: String!, $cursor: String, $count: Int!${refQueryVar}) {
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
