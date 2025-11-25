import { withDir } from 'tmp-promise';
import { GlobalConfig } from '../../../../config/global';
import { PackageCacheSqlite } from './sqlite';

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
  describe('Get operations', () => {
    it('returns undefined on cache miss', async () => {
      const res = await withSqlite((sqlite) =>
        sqlite.get('_test-namespace', 'bar'),
      );
      expect(res).toBeUndefined();
    });
  });

  describe('Set and get operations', () => {
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

  describe('Persistence', () => {
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
