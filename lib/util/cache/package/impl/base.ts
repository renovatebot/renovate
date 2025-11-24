import type { PackageCacheNamespace } from '../types';

export abstract class PackageCacheBase {
  abstract get<T = unknown>(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<T | undefined>;

  abstract set<T = unknown>(
    namespace: PackageCacheNamespace,
    key: string,
    value: T,
    hardTtlMinutes: number,
  ): Promise<void>;

  async destroy(): Promise<void> {
    // no-op by default
  }
}
