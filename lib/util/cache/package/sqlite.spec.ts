import { withDir } from 'tmp-promise';
import { GlobalConfig } from '../../../config/global';
import { SqlitePackageCache } from './sqlite';

function withSqlite<T>(
  fn: (sqlite: SqlitePackageCache) => Promise<T>,
): Promise<T> {
  return withDir(
    async ({ path }) => {
      GlobalConfig.set({ cacheDir: path });
      const sqlite = await SqlitePackageCache.init(path);
      const res = await fn(sqlite);
      await sqlite.cleanup();
      return res;
    },
    { unsafeCleanup: true },
  );
}

describe('util/cache/package/sqlite', () => {
  it('should get undefined', async () => {
    const res = await withSqlite((sqlite) => sqlite.get('foo', 'bar'));
    expect(res).toBeUndefined();
  });

  it('should set and get', async () => {
    const res = await withSqlite(async (sqlite) => {
      await sqlite.set('foo', 'bar', { foo: 'foo' });
      await sqlite.set('foo', 'bar', { bar: 'bar' });
      await sqlite.set('foo', 'bar', { baz: 'baz' });
      return sqlite.get('foo', 'bar');
    });
    expect(res).toEqual({ baz: 'baz' });
  });

  it('reopens', async () => {
    const res = await withDir(
      async ({ path }) => {
        GlobalConfig.set({ cacheDir: path });

        const client1 = await SqlitePackageCache.init(path);
        await client1.set('foo', 'bar', 'baz');
        await client1.cleanup();

        const client2 = await SqlitePackageCache.init(path);
        const res = await client2.get('foo', 'bar');
        await client2.cleanup();
        return res;
      },
      { unsafeCleanup: true },
    );

    expect(res).toBe('baz');
  });
});
