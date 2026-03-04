import type { PackageCacheNamespace } from '../types.ts';

export abstract class PackageCacheBase {
  abstract get<T = unknown>(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<T | undefined>;

  abstract set(
    namespace: PackageCacheNamespace,
    key: string,
    value: unknown,
    hardTtlMinutes: number,
  ): Promise<void>;

  abstract destroy(): Promise<void>;
}
