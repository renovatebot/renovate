import { withDir } from 'tmp-promise';
import { GlobalConfig } from '../../../../config/global.ts';
import { PackageCacheSqlite } from './sqlite.ts';

function withSqlite<T>(
  fn: (sqlite: PackageCacheSqlite) => Promise<T>,
): Promise<T> {
  return withDir(
    async ({ path }) => {
      GlobalConfig.set({ cacheDir: path });
      const sqlite = await PackageCacheSqlite.create(path);
      const res = await fn(sqlite);
      await sqlite.destroy();
      return res;
    },
    { unsafeCleanup: true },
  );
}

describe('util/cache/package/impl/sqlite', () => {
  describe('get', () => {
    it('returns undefined on cache miss', async () => {
      const res = await withSqlite((sqlite) =>
        sqlite.get('_test-namespace', 'bar'),
      );

      expect(res).toBeUndefined();
    });
  });

  describe('set and get', () => {
    it('overwrites and returns latest value', async () => {
      const res = await withSqlite(async (sqlite) => {
        await sqlite.set('_test-namespace', 'bar', { foo: 'foo' }, 5);
        await sqlite.set('_test-namespace', 'bar', { bar: 'bar' }, 5);
        await sqlite.set('_test-namespace', 'bar', { baz: 'baz' }, 5);
        return sqlite.get('_test-namespace', 'bar');
      });

      expect(res).toEqual({ baz: 'baz' });
    });
  });

  describe('expiry', () => {
    it('returns undefined for immediately expired entry', async () => {
      const res = await withSqlite(async (sqlite) => {
        await sqlite.set('_test-namespace', 'bar', 'value', -1);
        return sqlite.get('_test-namespace', 'bar');
      });

      expect(res).toBeUndefined();
    });
  });

  describe('destroy', () => {
    it('deletes expired entries and closes database', async () => {
      const res = await withDir(
        async ({ path }) => {
          GlobalConfig.set({ cacheDir: path });

          const client1 = await PackageCacheSqlite.create(path);
          await client1.set('_test-namespace', 'expired', 'old', -1);
          await client1.set('_test-namespace', 'valid', 'fresh', 5);
          await client1.destroy();

          const client2 = await PackageCacheSqlite.create(path);
          const expired = await client2.get('_test-namespace', 'expired');
          const valid = await client2.get('_test-namespace', 'valid');
          await client2.destroy();
          return { expired, valid };
        },
        { unsafeCleanup: true },
      );

      expect(res.expired).toBeUndefined();
      expect(res.valid).toBe('fresh');
    });
  });

  describe('persistence', () => {
    it('retrieves value from persistent storage after reopening', async () => {
      const res = await withDir(
        async ({ path }) => {
          GlobalConfig.set({ cacheDir: path });

          const client1 = await PackageCacheSqlite.create(path);
          await client1.set('_test-namespace', 'bar', 'baz', 5);
          await client1.destroy();

          const client2 = await PackageCacheSqlite.create(path);
          const data = await client2.get('_test-namespace', 'bar');
          await client2.destroy();
          return data;
        },
        { unsafeCleanup: true },
      );

      expect(res).toBe('baz');
    });
  });
});
