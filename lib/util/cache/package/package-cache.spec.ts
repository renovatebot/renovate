import { LRUCache } from 'lru-cache';
import { type DirectoryResult, dir } from 'tmp-promise';
import { partial } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type { PackageCacheBase } from './impl/base.ts';
import { PackageCacheFile } from './impl/file.ts';
import { type MemoryEntry, PackageCache } from './package-cache.ts';

vi.unmock('../../mutex.ts');

describe('util/cache/package/package-cache', () => {
  let memory: LRUCache<string, MemoryEntry>;

  beforeEach(() => {
    memory = new LRUCache({ maxSize: 1024 ** 2 });
  });

  describe('File backend', () => {
    let tmpDir: DirectoryResult;
    let cacheDir: string;
    let cache: PackageCache;

    beforeEach(async () => {
      tmpDir = await dir({ unsafeCleanup: true });
      cacheDir = tmpDir.path;
      const backend = PackageCacheFile.create(cacheDir);
      cache = new PackageCache(backend, memory);
    });

    afterEach(async () => {
      await tmpDir.cleanup();
    });

    it('returns undefined on cache miss', async () => {
      const result = await cache.get('_test-namespace', 'missing-key');

      expect(result).toBeUndefined();
    });

    it('stores and retrieves values from cache', async () => {
      await cache.set('_test-namespace', 'some-key', { foo: 'bar' }, 10);

      const result = await cache.get('_test-namespace', 'some-key');

      expect(result).toEqual({ foo: 'bar' });
    });

    it('persists cache to file system across instances', async () => {
      await cache.set('_test-namespace', 'some-key', 'some-value', 10);

      const backend = PackageCacheFile.create(cacheDir);
      const newCache = new PackageCache(
        backend,
        new LRUCache<string, MemoryEntry>({ maxSize: memory.maxSize }),
      );

      const result = await newCache.get('_test-namespace', 'some-key');

      expect(result).toBe('some-value');
    });

    it('applies raw TTL when using setWithRawTtl', async () => {
      await cache.setWithRawTtl('_test-namespace', 'ttl-key', 'ttl-value', 10);

      const result = await cache.get('_test-namespace', 'ttl-key');

      expect(result).toBe('ttl-value');
    });

    it('cleans up backend resources on destroy', async () => {
      await expect(cache.destroy()).resolves.not.toThrow();
    });

    it('reloads evicted entries from L2 and retains the loaded value in L1', async () => {
      const backend = PackageCacheFile.create(cacheDir);
      const read = vi.spyOn(backend, 'get');
      cache = new PackageCache(backend, memory);
      await cache.set('_test-namespace', 'a', { version: '1.2.3' }, 10);
      await cache.set('_test-namespace', 'b', 'b'.repeat(600_000), 10);
      await cache.set('_test-namespace', 'c', 'c'.repeat(600_000), 10);

      const first = await cache.get('_test-namespace', 'a');
      const second = await cache.get('_test-namespace', 'a');

      expect(first).toEqual({ version: '1.2.3' });
      expect(second).toEqual({ version: '1.2.3' });
      expect(read).toHaveBeenCalledExactlyOnceWith('_test-namespace', 'a');
    });

    it.each([false, true])(
      'keeps L2 usable when L1 cannot retain a value (L1 enabled: %s)',
      async (enabled) => {
        const backend = PackageCacheFile.create(cacheDir);
        const read = vi.spyOn(backend, 'get');
        cache = new PackageCache(backend, enabled ? memory : null);
        const value = 'x'.repeat(1024 ** 2);

        await cache.setWithRawTtl('_test-namespace', 'large', value, 10);
        const first = await cache.get('_test-namespace', 'large');
        const second = await cache.get('_test-namespace', 'large');

        expect(first).toBe(value);
        expect(second).toBe(value);
        expect(read).toHaveBeenCalledTimes(2);
      },
    );
  });

  describe('Memory cache', () => {
    it('evicts the least recently read value when the size budget is reached', async () => {
      const cache = new PackageCache(undefined, memory);
      const value = 'x'.repeat(400_000);
      await cache.set('_test-namespace', 'a', value, 10);
      await cache.set('_test-namespace', 'b', value, 10);
      await expect(cache.get('_test-namespace', 'a')).resolves.toBe(value);

      await cache.set('_test-namespace', 'c', value, 10);

      await expect(cache.get('_test-namespace', 'b')).resolves.toBeUndefined();
      await expect(cache.get('_test-namespace', 'a')).resolves.toBe(value);
      await expect(cache.get('_test-namespace', 'c')).resolves.toBe(value);
    });

    it('passes the entry size in bytes to L1, including the key and overhead', async () => {
      const write = vi.spyOn(memory, 'set');
      const cache = new PackageCache(undefined, memory);

      await cache.set('_test-namespace', 'é', '😀', 10);

      expect(write).toHaveBeenCalledExactlyOnceWith(
        'datasource-mem:pkg-fetch:_test-namespace:é',
        { value: '😀' },
        { size: 187 },
      );
    });

    it.each([undefined, null, false, 0, ''])(
      'serves a stored value without reading the backend: %s',
      async (value) => {
        const backend = { get: vi.fn(), set: vi.fn() };
        const cache = new PackageCache(
          partial<PackageCacheBase>(backend),
          memory,
        );
        await cache.set('_test-namespace', 'a', value, 10);

        const result = await cache.get('_test-namespace', 'a');

        expect(result).toBe(value);
        expect(backend.get).not.toHaveBeenCalled();
      },
    );

    it('skips values that cannot be sized without preventing backend writes', async () => {
      const backend = { get: vi.fn(), set: vi.fn() };
      const cache = new PackageCache(
        partial<PackageCacheBase>(backend),
        memory,
      );
      const value = { count: 1n };
      await cache.set('_test-namespace', 'a', 'old', 10);

      await cache.set('_test-namespace', 'a', value, 10);

      await expect(cache.get('_test-namespace', 'a')).resolves.toBeUndefined();
      expect(backend.get).toHaveBeenCalledExactlyOnceWith(
        '_test-namespace',
        'a',
      );
      expect(backend.set).toHaveBeenLastCalledWith(
        '_test-namespace',
        'a',
        value,
        10,
      );
    });

    it('disables memory-only caching and supports reset and destroy', async () => {
      const cache = new PackageCache(undefined, null);
      await cache.set('_test-namespace', 'a', 'value', 10);

      cache.softReset();
      await cache.destroy();

      await expect(cache.get('_test-namespace', 'a')).resolves.toBeUndefined();
    });

    it('keeps same-key reads and writes serialized while other keys cause eviction', async () => {
      const started = Promise.withResolvers<void>();
      const read = Promise.withResolvers<string>();
      const value = 'x'.repeat(400_000);
      const backend = {
        get: vi.fn().mockImplementation(() => {
          started.resolve();
          return read.promise;
        }),
        set: vi.fn(),
      };
      const cache = new PackageCache(
        partial<PackageCacheBase>(backend),
        memory,
      );
      await cache.set('_test-namespace', 'b', value, 10);
      await cache.set('_test-namespace', 'c', value, 10);
      backend.set.mockClear();
      const first = cache.get('_test-namespace', 'a');
      await started.promise;
      const second = cache.get('_test-namespace', 'a');
      const write = cache.set('_test-namespace', 'a', 'new', 10);

      await cache.set('_test-namespace', 'd', value, 10);
      expect(backend.set).toHaveBeenCalledExactlyOnceWith(
        '_test-namespace',
        'd',
        value,
        10,
      );
      read.resolve('old');
      const results = await Promise.all([first, second, write]);

      expect(results).toEqual(['old', 'old', undefined]);
      expect(backend.get).toHaveBeenCalledExactlyOnceWith(
        '_test-namespace',
        'a',
      );
      await expect(cache.get('_test-namespace', 'a')).resolves.toBe('new');
      expect(backend.set).toHaveBeenLastCalledWith(
        '_test-namespace',
        'a',
        'new',
        10,
      );
    });
  });

  describe('Mocked backend', () => {
    it('bypasses backend on L1 memory cache hit', async () => {
      const backend = { get: vi.fn(), set: vi.fn(), destroy: vi.fn() };
      const cache = new PackageCache(
        partial<PackageCacheBase>(backend),
        memory,
      );

      await cache.get('_test-namespace', 'key');
      expect(backend.get).toHaveBeenCalledTimes(1);

      await cache.set('_test-namespace', 'key', 'val', 1);

      backend.get.mockClear();
      const result = await cache.get('_test-namespace', 'key');

      expect(result).toBe('val');
      expect(backend.get).not.toHaveBeenCalled();
    });

    it('implements negative caching for undefined values in L1', async () => {
      const write = vi.spyOn(memory, 'set');
      const backend = {
        get: vi.fn().mockResolvedValue(undefined),
        set: vi.fn(),
        destroy: vi.fn(),
      };
      const cache = new PackageCache(
        partial<PackageCacheBase>(backend),
        memory,
      );

      const firstResult = await cache.get('_test-namespace', 'missing');

      expect(write).toHaveBeenCalledExactlyOnceWith(
        'datasource-mem:pkg-fetch:_test-namespace:missing',
        { value: undefined },
        { size: 178 },
      );
      expect(firstResult).toBeUndefined();
      expect(backend.get).toHaveBeenCalledTimes(1);

      backend.get.mockClear();
      const secondResult = await cache.get('_test-namespace', 'missing');

      expect(secondResult).toBeUndefined();
      expect(backend.get).not.toHaveBeenCalled();
    });

    it('evicts L1 memory cache on softReset', async () => {
      const backend = {
        get: vi.fn().mockResolvedValue('value'),
        set: vi.fn(),
        destroy: vi.fn(),
      };
      const cache = new PackageCache(
        partial<PackageCacheBase>(backend),
        memory,
      );

      await cache.get('_test-namespace', 'key');
      expect(backend.get).toHaveBeenCalledTimes(1);

      await cache.get('_test-namespace', 'key');
      expect(backend.get).toHaveBeenCalledTimes(1);

      cache.softReset();

      await cache.get('_test-namespace', 'key');
      expect(backend.get).toHaveBeenCalledTimes(2);
    });

    it.each(['backend-value', undefined, null, false, 0, ''])(
      'deduplicates concurrent requests via mutex for %s',
      async (value) => {
        const backend = {
          get: vi.fn().mockResolvedValue(value),
          set: vi.fn(),
          destroy: vi.fn(),
        };
        const cache = new PackageCache(
          partial<PackageCacheBase>(backend),
          memory,
        );

        const results = await Promise.all([
          cache.get('_test-namespace', 'concurrent'),
          cache.get('_test-namespace', 'concurrent'),
        ]);

        expect(results).toEqual([value, value]);
        expect(backend.get).toHaveBeenCalledTimes(1);
      },
    );

    it('serves set() value from L1 without hitting backend', async () => {
      const backend = { get: vi.fn(), set: vi.fn(), destroy: vi.fn() };
      const cache = new PackageCache(
        partial<PackageCacheBase>(backend),
        memory,
      );

      await cache.set('_test-namespace', 'key', 'val', 1);

      const result = await cache.get('_test-namespace', 'key');

      expect(result).toBe('val');
      expect(backend.get).not.toHaveBeenCalled();
    });

    it('propagates backend errors without writing to L1', async () => {
      const backend = {
        get: vi.fn().mockRejectedValue(new Error('backend failure')),
        set: vi.fn(),
        destroy: vi.fn(),
      };
      const cache = new PackageCache(
        partial<PackageCacheBase>(backend),
        memory,
      );

      await expect(cache.get('_test-namespace', 'key')).rejects.toThrow(
        'backend failure',
      );

      await expect(cache.get('_test-namespace', 'key')).rejects.toThrow(
        'backend failure',
      );
      expect(backend.get).toHaveBeenCalledTimes(2);
    });

    it('applies TTL override in set()', async () => {
      GlobalConfig.set({ cacheTtlOverride: { '_test-namespace': 99 } });
      const backend = {
        get: vi.fn(),
        set: vi.fn(),
        destroy: vi.fn(),
      };
      const cache = new PackageCache(
        partial<PackageCacheBase>(backend),
        memory,
      );

      await cache.set('_test-namespace', 'key', 'value', 10);

      expect(backend.set).toHaveBeenCalledWith(
        '_test-namespace',
        'key',
        'value',
        99,
      );
      GlobalConfig.reset();
    });

    it('clears L1 and calls backend.destroy on destroy', async () => {
      const backend = {
        get: vi.fn().mockResolvedValueOnce('value'),
        set: vi.fn(),
        destroy: vi.fn(),
      };
      const cache = new PackageCache(
        partial<PackageCacheBase>(backend),
        memory,
      );

      await expect(cache.get('_test-namespace', 'key')).resolves.toBe('value');

      await cache.destroy();

      await expect(
        cache.get('_test-namespace', 'key'),
      ).resolves.toBeUndefined();
      expect(backend.get).toHaveBeenCalledTimes(2);
      expect(backend.destroy).toHaveBeenCalled();
    });
  });

  describe('Memory-only (no backend)', () => {
    it('stores and retrieves from L1 memory only', async () => {
      const cache = new PackageCache(undefined, memory);

      await cache.set('_test-namespace', 'key', 'value', 10);

      const result = await cache.get('_test-namespace', 'key');

      expect(result).toBe('value');
    });

    it('returns undefined on L1 miss with no backend', async () => {
      const cache = new PackageCache(undefined, memory);

      const result = await cache.get('_test-namespace', 'missing-key');

      expect(result).toBeUndefined();
    });
  });
});
