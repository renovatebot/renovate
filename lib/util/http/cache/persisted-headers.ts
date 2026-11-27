import type { HttpCacheResponse } from './schema.ts';

/**
 * The response headers that are safe to keep in a persisted cache entry.
 *
 * The `renovate/cached-response-headers` lint rule keeps header reads of responses which may come from a persisted cache within this list.
 */
export const persistedResponseHeaders: readonly string[] = [
  'cache-control',
  'deprecation',
  'etag',
  'last-modified',
  'link',
  'sunset',
  'x-total-count',
];

/**
 * Returns the `names` out of `headers` which are set.
 */
export function pickHeaders(
  headers: HttpCacheResponse['headers'],
  names: readonly string[],
): HttpCacheResponse['headers'] {
  const picked: HttpCacheResponse['headers'] = {};
  for (const name of names) {
    if (headers[name] !== undefined) {
      picked[name] = headers[name];
    }
  }
  return picked;
}
