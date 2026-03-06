import { withTimeout } from 'async-mutex';
import { getMutex } from '../../mutex.ts';
import { PackageCacheStats } from '../../stats.ts';
import { PackageCacheBase } from './impl/base.ts';
import { getTtlOverride } from './ttl.ts';
import type { PackageCacheNamespace } from './types.ts';

const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000;

export class PackageCache extends PackageCacheBase {
  readonly memory = new Map<string, unknown>();
  private readonly backend: PackageCacheBase | undefined;

  constructor(backend?: PackageCacheBase) {
    super();
    this.backend = backend;
  }

  async get<T = unknown>(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<T | undefined> {
    const combinedKey = `${namespace}:${key}`;
    if (this.memory.has(combinedKey)) {
      return this.memory.get(combinedKey) as T;
    }

    return await withTimeout(
      getMutex(combinedKey, 'package-cache'),
      DEFAULT_TIMEOUT_MS,
    ).runExclusive(async () => {
      if (this.memory.has(combinedKey)) {
        return this.memory.get(combinedKey) as T;
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

    this.memory.set(`${namespace}:${key}`, value);

    return value;
  }

  async set(
    namespace: PackageCacheNamespace,
    key: string,
    value: unknown,
    hardTtlMinutes: number,
  ): Promise<void> {
    const rawTtl = getTtlOverride(namespace) ?? hardTtlMinutes;
    const combinedKey = `${namespace}:${key}`;

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
    const combinedKey = `${namespace}:${key}`;

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
    this.memory.set(`${namespace}:${key}`, value);

    const backend = this.backend;
    if (backend) {
      await PackageCacheStats.wrapSet(() =>
        backend.set(namespace, key, value, hardTtlMinutes),
      );
    }
  }

  softReset(): void {
    this.memory.clear();
  }

  async destroy(): Promise<void> {
    this.memory.clear();
    await this.backend?.destroy();
  }
}
