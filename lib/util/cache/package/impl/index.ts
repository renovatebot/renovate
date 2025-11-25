import type { AllConfig } from '../../../../config/types';
import { getEnv } from '../../../env';
import { getMutex } from '../../../mutex';
import { PackageCacheStats } from '../../../stats';
import { getTtlOverride } from '../ttl';
import type { PackageCacheNamespace } from '../types';
import { PackageCacheBase } from './base';
import { PackageCacheFile } from './file';
import { PackageCacheRedis } from './redis';
import { PackageCacheSqlite } from './sqlite';

export type CacheType = 'redis' | 'sqlite' | 'file';

export class PackageCache extends PackageCacheBase {
  static async create(config: AllConfig): Promise<PackageCache> {
    if (config.redisUrl) {
      const backend = await PackageCacheRedis.create(
        config.redisUrl,
        config.redisPrefix,
      );
      return new PackageCache(backend, 'redis');
    }

    if (getEnv().RENOVATE_X_SQLITE_PACKAGE_CACHE && config.cacheDir) {
      const backend = await PackageCacheSqlite.create(config.cacheDir);
      return new PackageCache(backend, 'sqlite');
    }

    if (config.cacheDir) {
      const backend = PackageCacheFile.create(config.cacheDir);
      return new PackageCache(backend, 'file');
    }

    return new PackageCache();
  }

  // In-memory layer is meant to live during a single Renovate run
  readonly memory = new Map<string, unknown>();

  constructor(
    private readonly backend?: PackageCacheBase,
    private readonly cacheType?: CacheType,
  ) {
    super();
  }

  async get<T = unknown>(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<T | undefined> {
    const combinedKey = `${namespace}:${key}`;
    if (this.memory.has(combinedKey)) {
      return this.memory.get(combinedKey) as T;
    }

    return await getMutex(combinedKey, 'package-cache').runExclusive(() => {
      if (this.memory.has(combinedKey)) {
        return this.memory.get(combinedKey) as T;
      }

      return this.getUnsynced<T>(namespace, key);
    });
  }

  /**
   * NOTE: This MUST NOT be used outside of cache implementation, use `get()` instead
   */
  async getUnsynced<T = unknown>(
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

    this.memory.set(`${namespace}:${key}`, value);

    return value;
  }

  async set<T = unknown>(
    namespace: PackageCacheNamespace,
    key: string,
    value: T,
    hardTtlMinutes: number,
  ): Promise<void> {
    const rawTtl = getTtlOverride(namespace) ?? hardTtlMinutes;
    const combinedKey = `${namespace}:${key}`;
    await getMutex(combinedKey, 'package-cache').runExclusive(async () => {
      await this.setWithRawTtl(namespace, key, value, rawTtl);
    });
  }

  /**
   * NOTE: This MUST NOT be used outside of cache implementation, use `set()` instead
   */
  async setWithRawTtl<T = unknown>(
    namespace: PackageCacheNamespace,
    key: string,
    value: T,
    hardTtlMinutes: number,
  ): Promise<void> {
    const combinedKey = `${namespace}:${key}`;
    const backend = this.backend;
    if (backend) {
      await PackageCacheStats.wrapSet(() =>
        backend.set(namespace, key, value, hardTtlMinutes),
      );
    }

    this.memory.set(combinedKey, value);
  }

  getType(): CacheType | undefined {
    return this.cacheType;
  }

  reset(): void {
    this.memory.clear();
  }

  override async destroy(): Promise<void> {
    this.memory.clear();
    await this.backend?.destroy();
  }
}
