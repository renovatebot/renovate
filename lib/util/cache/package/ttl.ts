import is from '@sindresorhus/is';
import { GlobalConfig } from '../../../config/global';
import { matchRegexOrGlob } from '../../string-match';
import type { PackageCacheNamespace } from './types';

/**
 * This MUST NOT be used outside of cache implementation
 *
 * @param namespace
 */
export function getTtlOverride(
  namespace: PackageCacheNamespace,
): number | undefined {
  const overrides = GlobalConfig.get('cacheTtlOverride', {});
  let ttl: number | undefined = overrides[namespace];
  if (is.number(ttl)) {
    return ttl;
  }

  let maxLen = 0;
  for (const [key, value] of Object.entries(overrides)) {
    if (!is.number(value)) {
      continue;
    }

    const keyLen = key.length;
    if (keyLen > maxLen && matchRegexOrGlob(namespace, key)) {
      maxLen = keyLen;
      ttl = value;
    }
  }

  if (is.number(ttl)) {
    return ttl;
  }

  return undefined;
}

export interface TTLValues {
  /** TTL for serving cached value without hitting the server */
  softTtlMinutes: number;

  /** TTL for serving stale cache when upstream responds with errors */
  hardTtlMinutes: number;
}

/**
 * Apply user-configured overrides and return the final values for soft/hard TTL.
 *
 * @param namespace Cache namespace
 * @param ttlMinutes TTL value configured in Renovate codebase
 * @returns
 */
export function resolveTtlValues(
  namespace: PackageCacheNamespace,
  ttlMinutes: number,
): TTLValues {
  const softTtlMinutes = getTtlOverride(namespace) ?? ttlMinutes;

  const cacheHardTtlMinutes = GlobalConfig.get(
    'cacheHardTtlMinutes',
    7 * 24 * 60,
  );
  const hardTtlMinutes = Math.max(softTtlMinutes, cacheHardTtlMinutes);

  return { softTtlMinutes, hardTtlMinutes };
}
