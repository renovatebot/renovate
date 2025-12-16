import { type DirectoryResult, dir } from 'tmp-promise';
import type { PackageCacheBase } from './base';
import { PackageCacheFile } from './file';
import { PackageCache } from './index';
import { partial } from '~test/util';

vi.unmock('../../../mutex');

describe('util/cache/package/impl/index', () => {
  describe('File backend', () => {
    let tmpDir: DirectoryResult;
    let cacheDir: string;
    let cache: PackageCache;

    beforeEach(async () => {
      tmpDir = await dir({ unsafeCleanup: true });
      cacheDir = tmpDir.path;
      const backend = PackageCacheFile.create(cacheDir);
      cache = new PackageCache(backend);
    });

    afterEach(async () => {
      await tmpDir.cleanup();
    });

    describe('Basic operations', () => {
      it('returns undefined on cache miss', async () => {
        const result = await cache.get('_test-namespace', 'missing-key');
        expect(result).toBeUndefined();
      });

      it('stores and retrieves values from cache', async () => {
        await cache.set('_test-namespace', 'some-key', { foo: 'bar' }, 10);

        const result = await cache.get('_test-namespace', 'some-key');
        expect(result).toEqual({ foo: 'bar' });
      });
    });

    describe('Persistence', () => {
      it('persists cache to file system across instances', async () => {
        await cache.set('_test-namespace', 'some-key', 'some-value', 10);

        const backend = PackageCacheFile.create(cacheDir);
        const newCache = new PackageCache(backend);

        const result = await newCache.get('_test-namespace', 'some-key');
        expect(result).toBe('some-value');
      });
    });

    describe('TTL handling', () => {
      it('applies raw TTL when using setWithRawTtl', async () => {
        await cache.setWithRawTtl(
          '_test-namespace',
          'ttl-key',
          'ttl-value',
          10,
        );

        const result = await cache.get('_test-namespace', 'ttl-key');
        expect(result).toBe('ttl-value');
      });
    });

    describe('Resource cleanup', () => {
      it('cleans up backend resources on destroy', async () => {
        await expect(cache.destroy()).resolves.not.toThrow();
      });
    });
  });

  describe('Memory caching with mocked backend', () => {
    describe('L1 memory cache', () => {
      it('bypasses backend on L1 memory cache hit', async () => {
        const backend = { get: vi.fn(), set: vi.fn(), destroy: vi.fn() };
        const cache = new PackageCache(partial<PackageCacheBase>(backend));

        await cache.get('_test-namespace', 'key');
        expect(backend.get).toHaveBeenCalledTimes(1);

        await cache.set('_test-namespace', 'key', 'val', 1);

        backend.get.mockClear();
        const result = await cache.get('_test-namespace', 'key');
        expect(result).toBe('val');
        expect(backend.get).not.toHaveBeenCalled();
      });

      it('implements negative caching for undefined values in L1', async () => {
        const backend = {
          get: vi.fn().mockResolvedValue(undefined),
          set: vi.fn(),
          destroy: vi.fn(),
        };
        const cache = new PackageCache(partial<PackageCacheBase>(backend));

        const firstResult = await cache.get('_test-namespace', 'missing');
        expect(firstResult).toBeUndefined();
        expect(backend.get).toHaveBeenCalledTimes(1);

        backend.get.mockClear();
        const secondResult = await cache.get('_test-namespace', 'missing');
        expect(secondResult).toBeUndefined();
        expect(backend.get).not.toHaveBeenCalled();
      });

      it('evicts L1 memory cache on reset', async () => {
        const backend = {
          get: vi.fn().mockResolvedValue('value'),
          set: vi.fn(),
          destroy: vi.fn(),
        };
        const cache = new PackageCache(partial<PackageCacheBase>(backend));

        await cache.get('_test-namespace', 'key');
        expect(backend.get).toHaveBeenCalledTimes(1);

        await cache.get('_test-namespace', 'key');
        expect(backend.get).toHaveBeenCalledTimes(1);

        cache.reset();

        await cache.get('_test-namespace', 'key');
        expect(backend.get).toHaveBeenCalledTimes(2);
      });
    });

    describe('Concurrency control', () => {
      it('deduplicates concurrent requests via mutex', async () => {
        const backend = {
          get: vi.fn().mockResolvedValue('backend-value'),
          set: vi.fn(),
          destroy: vi.fn(),
        };
        const cache = new PackageCache(partial<PackageCacheBase>(backend));

        const results = await Promise.all([
          cache.get('_test-namespace', 'concurrent'),
          cache.get('_test-namespace', 'concurrent'),
        ]);

        expect(results).toEqual(['backend-value', 'backend-value']);
        expect(backend.get).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Memory-only cache (no backend)', () => {
    it('stores and retrieves from L1 memory only', async () => {
      const noBackendCache = new PackageCache();
      await noBackendCache.set('_test-namespace', 'key', 'value', 10);

      const result = await noBackendCache.get('_test-namespace', 'key');
      expect(result).toBe('value');
    });

    it('returns undefined on L1 miss with no backend', async () => {
      const noBackendCache = new PackageCache();

      const result = await noBackendCache.get('_test-namespace', 'missing-key');
      expect(result).toBeUndefined();
    });
  });
});
