import { withDir } from 'tmp-promise';
import { SqlitePackageCache } from './sqlite';

function withSqlite<T>(
  fn: (sqlite: SqlitePackageCache) => T | Promise<T>,
): Promise<T> {
  return withDir(
    async ({ path }) => {
      const sqlite = await SqlitePackageCache.init(path);
      const res = await fn(sqlite);
      sqlite.close();
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
    const res = await withSqlite((sqlite) => {
      sqlite.set('foo', 'bar', { foo: 'bar' });
      return sqlite.get('foo', 'bar');
    });
    expect(res).toEqual({ foo: 'bar' });
  });
});
