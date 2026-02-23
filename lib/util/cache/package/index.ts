import type { AllConfig } from '../../../config/types.ts';
import { PackageCacheStats } from '../../stats.ts';
import * as memCache from '../memory/index.ts';
import * as backend from './backend.ts';
import { getCombinedKey } from './key.ts';
import { getTtlOverride } from './ttl.ts';
import type { PackageCacheNamespace } from './types.ts';

export function getCacheType(): ReturnType<typeof backend.getCacheType> {
  return backend.getCacheType();
}

export async function get<T = any>(
  namespace: PackageCacheNamespace,
  key: string,
): Promise<T | undefined> {
  if (!backend.getCacheType()) {
    return undefined;
  }

  const combinedKey = getCombinedKey(namespace, key);
  let cachedPromise = memCache.get(combinedKey);
  if (!cachedPromise) {
    cachedPromise = PackageCacheStats.wrapGet(() =>
      backend.get(namespace, key),
    );
    memCache.set(combinedKey, cachedPromise);
  }

  return await cachedPromise;
}

/**
 * Set cache value with user-defined TTL overrides.
 */
export async function set(
  namespace: PackageCacheNamespace,
  key: string,
  value: unknown,
  hardTtlMinutes: number,
): Promise<void> {
  const rawTtl = getTtlOverride(namespace) ?? hardTtlMinutes;
  await setWithRawTtl(namespace, key, value, rawTtl);
}

/**
 * Set cache value ignoring user-defined TTL overrides.
 * This MUST NOT be used outside of cache implementation
 */
export async function setWithRawTtl(
  namespace: PackageCacheNamespace,
  key: string,
  value: unknown,
  hardTtlMinutes: number,
): Promise<void> {
  if (!backend.getCacheType()) {
    return;
  }

  await PackageCacheStats.wrapSet(() =>
    backend.set(namespace, key, value, hardTtlMinutes),
  );

  const combinedKey = getCombinedKey(namespace, key);
  const p = Promise.resolve(value);
  memCache.set(combinedKey, p);
}

export async function init(config: AllConfig): Promise<void> {
  await backend.init(config);
}

export async function cleanup(_config: AllConfig): Promise<void> {
  await backend.destroy();
}
