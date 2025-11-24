import type { PackageCacheNamespace } from '../types';
import { PackageCacheBase } from './base';

class TestPackageCache extends PackageCacheBase {
  async get<T = unknown>(
    _namespace: PackageCacheNamespace,
    _key: string,
  ): Promise<T | undefined> {
    return undefined;
  }

  async set<T = unknown>(
    _namespace: PackageCacheNamespace,
    _key: string,
    _value: T,
    _hardTtlMinutes: number,
  ): Promise<void> {
    // no-op
  }
}

describe('util/cache/package/impl/base', () => {
  it('destroy does nothing', async () => {
    const cache = new TestPackageCache();
    await expect(cache.destroy()).resolves.not.toThrow();
  });
});
