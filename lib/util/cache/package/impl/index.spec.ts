import { type DirectoryResult, dir } from 'tmp-promise';
import { PackageCacheFile } from './file';
import { PackageCache } from './index';

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

    it('returns undefined on miss', async () => {
      expect(await cache.get('_test-namespace', 'missing-key')).toBeUndefined();
    });

    it('sets and gets value', async () => {
      await cache.set('_test-namespace', 'some-key', { foo: 'bar' }, 10);
      expect(await cache.get('_test-namespace', 'some-key')).toEqual({
        foo: 'bar',
      });
    });

    it('persists to file system', async () => {
      await cache.set('_test-namespace', 'some-key', 'some-value', 10);

      // Create new cache instance pointing to same dir
      const backend = PackageCacheFile.create(cacheDir);
      const newCache = new PackageCache(backend);

      expect(await newCache.get('_test-namespace', 'some-key')).toBe(
        'some-value',
      );
    });

    it('handles setWithRawTtl', async () => {
      await cache.setWithRawTtl('_test-namespace', 'ttl-key', 'ttl-value', 10);
      expect(await cache.get('_test-namespace', 'ttl-key')).toBe('ttl-value');
    });

    it('destroys backend', async () => {
      await expect(cache.destroy()).resolves.not.toThrow();
    });
  });

  describe('Mocked backend', () => {
    it('uses memory cache', async () => {
      const backend = {
        get: vi.fn(),
        set: vi.fn(),
        destroy: vi.fn(),
      } as any;
      const cache = new PackageCache(backend);

      // First get - miss in memory, miss in backend
      await cache.get('_test-namespace', 'key');
      expect(backend.get).toHaveBeenCalledTimes(1);

      // Set value
      await cache.set('_test-namespace', 'key', 'val', 1);

      // Second get - hit in memory
      backend.get.mockClear();
      expect(await cache.get('_test-namespace', 'key')).toBe('val');
      expect(backend.get).not.toHaveBeenCalled();
    });

    it('handles concurrent access', async () => {
      const backend = {
        get: vi.fn().mockResolvedValue('backend-value'),
        set: vi.fn(),
        destroy: vi.fn(),
      } as any;
      const cache = new PackageCache(backend);

      const results = await Promise.all([
        cache.get('_test-namespace', 'concurrent'),
        cache.get('_test-namespace', 'concurrent'),
      ]);

      expect(results).toEqual(['backend-value', 'backend-value']);
      expect(backend.get).toHaveBeenCalledTimes(1);
    });

    it('caches undefined (negative caching)', async () => {
      const backend = {
        get: vi.fn().mockResolvedValue(undefined),
        set: vi.fn(),
        destroy: vi.fn(),
      } as any;
      const cache = new PackageCache(backend);

      // First get - miss in memory, miss in backend
      expect(await cache.get('_test-namespace', 'missing')).toBeUndefined();
      expect(backend.get).toHaveBeenCalledTimes(1);

      // Second get - hit in memory (negative cache)
      backend.get.mockClear();
      expect(await cache.get('_test-namespace', 'missing')).toBeUndefined();
      expect(backend.get).not.toHaveBeenCalled();
    });

    it('cleans up memory cache', async () => {
      const backend = {
        get: vi.fn().mockResolvedValue('value'),
        set: vi.fn(),
        destroy: vi.fn(),
      } as any;
      const cache = new PackageCache(backend);

      // Populate memory cache
      await cache.get('_test-namespace', 'key');
      expect(backend.get).toHaveBeenCalledTimes(1);

      // Verify hit
      await cache.get('_test-namespace', 'key');
      expect(backend.get).toHaveBeenCalledTimes(1);

      // Cleanup
      cache.reset();

      // Verify miss in memory
      await cache.get('_test-namespace', 'key');
      expect(backend.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('No backend', () => {
    it('handles set/get', async () => {
      const noBackendCache = new PackageCache();
      await noBackendCache.set('_test-namespace', 'key', 'value', 10);
      expect(await noBackendCache.get('_test-namespace', 'key')).toBe('value');
    });

    it('returns undefined on miss', async () => {
      const noBackendCache = new PackageCache();
      expect(
        await noBackendCache.get('_test-namespace', 'missing-key'),
      ).toBeUndefined();
    });
  });
});
