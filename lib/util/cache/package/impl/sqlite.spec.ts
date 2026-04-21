import { promisify } from 'node:util';
import zlib from 'node:zlib';
import { withDir } from 'tmp-promise';
import { logger as _logger } from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import { PackageCacheSqlite } from './sqlite.ts';

const { logger } = _logger;

export const brotliCompress = promisify(zlib.brotliCompress);

function withSqliteDir<T>(fn: (cacheDir: string) => Promise<T>): Promise<T> {
  return withDir(
    async ({ path }) => {
      GlobalConfig.set({ cacheDir: path });
      return await fn(path);
    },
    { unsafeCleanup: true },
  );
}

function withSqlite<T>(
  fn: (sqlite: PackageCacheSqlite) => Promise<T>,
): Promise<T> {
  return withSqliteDir(async (cacheDir) => {
    const sqlite = await PackageCacheSqlite.create(cacheDir);

    try {
      return await fn(sqlite);
    } finally {
      await sqlite.destroy();
    }
  });
}

function insertRawCacheEntry(
  sqlite: PackageCacheSqlite,
  key: string,
  value: Buffer,
): void {
  sqlite.client
    .prepare(
      `
        INSERT INTO package_cache (namespace, key, expiry, data)
        VALUES (?, ?, unixepoch() + 300, ?)
      `,
    )
    .run('_test-namespace', key, value);
}

describe('util/cache/package/impl/sqlite', () => {
  describe('get', () => {
    it('returns undefined on cache miss', async () => {
      const res = await withSqlite((sqlite) =>
        sqlite.get('_test-namespace', 'bar'),
      );

      expect(res).toBeUndefined();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('returns undefined for invalid compressed payload', async () => {
      const res = await withSqlite(async (sqlite) => {
        insertRawCacheEntry(sqlite, 'bar', Buffer.from('not-brotli'));

        return sqlite.get('_test-namespace', 'bar');
      });

      expect(res).toBeUndefined();
      expect(logger.once.warn).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Error while reading SQLite cache value',
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('returns undefined for invalid JSON payload', async () => {
      const res = await withSqlite(async (sqlite) => {
        const compressed = await brotliCompress('not-json');
        insertRawCacheEntry(sqlite, 'bar', compressed);

        return sqlite.get('_test-namespace', 'bar');
      });

      expect(res).toBeUndefined();
      expect(logger.once.warn).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Error while reading SQLite cache value',
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('returns undefined when the read fails', async () => {
      await withSqliteDir(async (cacheDir) => {
        const sqlite = await PackageCacheSqlite.create(cacheDir);

        try {
          sqlite.client.exec('DROP TABLE package_cache');

          const res = await sqlite.get('_test-namespace', 'bar');

          expect(res).toBeUndefined();
          expect(logger.once.warn).toHaveBeenCalledWith(
            { err: expect.any(Error) },
            'Error while reading SQLite cache value',
          );
          expect(logger.trace).not.toHaveBeenCalledWith(
            { namespace: '_test-namespace', key: 'bar' },
            'Cache miss',
          );
          expect(logger.warn).not.toHaveBeenCalled();
        } finally {
          sqlite.client.close();
        }
      });
    });
  });

  describe('set', () => {
    it('logs a warning and continues when serialization fails', async () => {
      const circular: { self?: unknown } = {};
      circular.self = circular;

      await expect(
        withSqlite((sqlite) =>
          sqlite.set('_test-namespace', 'bar', circular, 5),
        ),
      ).resolves.toBeUndefined();

      expect(logger.once.warn).toHaveBeenCalledWith(
        { err: expect.any(TypeError) },
        'Error while setting SQLite cache value',
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('logs a warning and continues when the write fails', async () => {
      await withSqliteDir(async (cacheDir) => {
        const sqlite = await PackageCacheSqlite.create(cacheDir);

        try {
          sqlite.client.exec('DROP TABLE package_cache');

          await expect(
            sqlite.set('_test-namespace', 'bar', { foo: 'bar' }, 5),
          ).resolves.toBeUndefined();

          expect(logger.once.warn).toHaveBeenCalledWith(
            { err: expect.any(Error) },
            'Error while setting SQLite cache value',
          );
          expect(logger.warn).not.toHaveBeenCalled();
        } finally {
          sqlite.client.close();
        }
      });
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
      const res = await withSqliteDir(async (cacheDir) => {
        const client1 = await PackageCacheSqlite.create(cacheDir);
        await client1.set('_test-namespace', 'expired', 'old', -1);
        await client1.set('_test-namespace', 'valid', 'fresh', 5);
        await client1.destroy();

        const client2 = await PackageCacheSqlite.create(cacheDir);
        const expired = await client2.get('_test-namespace', 'expired');
        const valid = await client2.get('_test-namespace', 'valid');
        await client2.destroy();

        return { expired, valid };
      });

      expect(res.expired).toBeUndefined();
      expect(res.valid).toBe('fresh');
    });

    it('resolves and still closes when cleanup throws', async () => {
      await withSqliteDir(async (cacheDir) => {
        const sqlite = await PackageCacheSqlite.create(cacheDir);
        sqlite.client.exec('DROP TABLE package_cache');

        await expect(sqlite.destroy()).resolves.toBeUndefined();

        expect(logger.warn).toHaveBeenCalledWith(
          { err: expect.any(Error) },
          'SQLite package cache cleanup failed',
        );
        expect(() => sqlite.client.prepare('SELECT 1').get()).toThrow();
      });
    });

    it('resolves when close throws', async () => {
      await withSqliteDir(async (cacheDir) => {
        const sqlite = await PackageCacheSqlite.create(cacheDir);
        insertRawCacheEntry(sqlite, 'bar', Buffer.from('value'));
        const iterator = sqlite.client
          .prepare('SELECT * FROM package_cache')
          .iterate();

        try {
          iterator.next();

          await expect(sqlite.destroy()).resolves.toBeUndefined();

          expect(logger.warn).toHaveBeenCalledWith(
            { err: expect.any(Error) },
            'SQLite package cache close failed',
          );
        } finally {
          iterator.return?.();
          sqlite.client.close();
        }
      });
    });
  });

  describe('persistence', () => {
    it('retrieves value from persistent storage after reopening', async () => {
      const res = await withSqliteDir(async (cacheDir) => {
        const client1 = await PackageCacheSqlite.create(cacheDir);
        await client1.set('_test-namespace', 'bar', 'baz', 5);
        await client1.destroy();

        const client2 = await PackageCacheSqlite.create(cacheDir);
        const data = await client2.get('_test-namespace', 'bar');
        await client2.destroy();
        return data;
      });

      expect(res).toBe('baz');
    });
  });
});
