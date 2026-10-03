import { withTimeout } from 'async-mutex';
import type { LRUCache } from 'lru-cache';
import { logger } from '../../../logger/index.ts';
import { getMutex } from '../../mutex.ts';
import { PackageCacheStats } from '../../stats.ts';
import type { PackageCacheBase } from './impl/base.ts';
import { getCombinedKey } from './key.ts';
import { getTtlOverride } from './ttl.ts';
import type { PackageCacheNamespace } from './types.ts';

const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000;

export interface MemoryEntry {
  value: unknown;
}

export class PackageCache {
  readonly memory: LRUCache<string, MemoryEntry> | null;
  private readonly backend: PackageCacheBase | undefined;

  constructor(
    backend: PackageCacheBase | undefined,
    memory: LRUCache<string, MemoryEntry> | null,
  ) {
    this.backend = backend;
    this.memory = memory;
  }

  async get<T = unknown>(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<T | undefined> {
    const combinedKey = getCombinedKey(namespace, key);
    if (this.memory?.has(combinedKey)) {
      return this.memory.get(combinedKey)!.value as T;
    }

    return await withTimeout(
      getMutex(combinedKey, 'package-cache'),
      DEFAULT_TIMEOUT_MS,
    ).runExclusive(async () => {
      if (this.memory?.has(combinedKey)) {
        return this.memory.get(combinedKey)!.value as T;
      }

      return await this.getUnsynced<T>(namespace, key);
    });
  }

  private async getUnsynced<T = unknown>(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<T | undefined> {
    const backend = this.backend;
    if (!backend) {
      return undefined;
    }

    const value = await PackageCacheStats.wrapGet(() =>
      backend.get<T>(namespace, key),
    );

    this.setMemory(getCombinedKey(namespace, key), value);

    return value;
  }

  async set(
    namespace: PackageCacheNamespace,
    key: string,
    value: unknown,
    hardTtlMinutes: number,
  ): Promise<void> {
    const rawTtl = getTtlOverride(namespace) ?? hardTtlMinutes;
    const combinedKey = getCombinedKey(namespace, key);

    await withTimeout(
      getMutex(combinedKey, 'package-cache'),
      DEFAULT_TIMEOUT_MS,
    ).runExclusive(async () => {
      await this.setUnsynced(namespace, key, value, rawTtl);
    });
  }

  async setWithRawTtl(
    namespace: PackageCacheNamespace,
    key: string,
    value: unknown,
    hardTtlMinutes: number,
  ): Promise<void> {
    const combinedKey = getCombinedKey(namespace, key);

    await withTimeout(
      getMutex(combinedKey, 'package-cache'),
      DEFAULT_TIMEOUT_MS,
    ).runExclusive(async () => {
      await this.setUnsynced(namespace, key, value, hardTtlMinutes);
    });
  }

  private async setUnsynced(
    namespace: PackageCacheNamespace,
    key: string,
    value: unknown,
    hardTtlMinutes: number,
  ): Promise<void> {
    this.setMemory(getCombinedKey(namespace, key), value);

    const backend = this.backend;
    if (backend) {
      await PackageCacheStats.wrapSet(() =>
        backend.set(namespace, key, value, hardTtlMinutes),
      );
    }
  }

  softReset(): void {
    this.memory?.clear();
  }

  async destroy(): Promise<void> {
    this.softReset();
    await this.backend?.destroy();
  }

  private setMemory(key: string, value: unknown): void {
    if (!this.memory) {
      return;
    }

    const entry = { value };
    let size: number;
    try {
      // Serialized bytes approximate retained data, not V8 heap usage. Include
      // keys and an allowance for bookkeeping, including cached misses.
      size =
        Buffer.byteLength(JSON.stringify(entry)) + Buffer.byteLength(key) + 128;
    } catch (err) {
      this.memory.delete(key);
      logger.once.debug(
        { err },
        'Unable to size package cache entry, skipping L1',
      );
      return;
    }

    this.memory.set(key, entry, { size });
  }
}
