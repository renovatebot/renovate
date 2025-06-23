import is from '@sindresorhus/is';
import { GlobalConfig } from '../../../config/global';
import type { PackageCacheNamespace } from './types';

export function getTtlOverride(
  namespace: PackageCacheNamespace,
): number | undefined {
  const ttl = GlobalConfig.get('cacheTtlOverride', {})[namespace];
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
