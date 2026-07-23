import { promisify } from 'node:util';
import zlib from 'node:zlib';
import { DateTime } from 'luxon';
import { withDir } from 'tmp-promise';
import { logger as _logger } from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import { decodeEntry, encodeEntry, isEnvelope } from '../codec.ts';
import { PackageCacheSqlite } from './sqlite.ts';

const { logger } = _logger;

// TODO: Delete this legacy raw-brotli fixture helper once legacy.ts is removed.
const brotliCompress = promisify(zlib.brotliCompress);

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
  ttlSeconds = 300,
): void {
  sqlite.client
    .prepare(
      `
        INSERT INTO package_cache (namespace, key, expiry, data)
        VALUES (?, ?, unixepoch() + ?, ?)
      `,
    )
    .run('_test-namespace', key, ttlSeconds, value);
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

    // TODO: Replace this legacy raw-brotli malformed-entry case with an
    // unsupported non-envelope fixture once legacy.ts is removed.
    it('removes invalid compressed payloads', async () => {
      const res = await withSqlite(async (sqlite) => {
        insertRawCacheEntry(sqlite, 'bar', Buffer.from('not-brotli'));

        const value = await sqlite.get('_test-namespace', 'bar');
        const row = sqlite.client
          .prepare(
            'SELECT data FROM package_cache WHERE namespace = ? AND key = ?',
          )
          .get('_test-namespace', 'bar');

        return { value, row };
      });

      expect(res.value).toBeUndefined();
      expect(res.row).toBeUndefined();
      expect(logger.once.debug).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Error while reading package cache value',
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });

    // TODO: Delete this legacy raw-brotli malformed-entry case once legacy.ts is
    // removed.
    it('returns undefined for invalid JSON payload', async () => {
      const res = await withSqlite(async (sqlite) => {
        const compressed = await brotliCompress('not-json');
        insertRawCacheEntry(sqlite, 'bar', compressed);

        return sqlite.get('_test-namespace', 'bar');
      });

      expect(res).toBeUndefined();
      expect(logger.once.debug).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Error while reading package cache value',
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
          expect(logger.once.debug).toHaveBeenCalledWith(
            { err: expect.any(Error) },
            'Error while reading package cache value',
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
    it('stores envelope payload with backend-native expiry', async () => {
      const res = await withSqlite(async (sqlite) => {
        await sqlite.set('_test-namespace', 'bar', { foo: 'bar' }, 5);
        const row = sqlite.client
          .prepare(
            `
              SELECT data, expiry > unixepoch() AS hasFutureExpiry
              FROM package_cache
              WHERE namespace = ? AND key = ?
            `,
          )
          .get('_test-namespace', 'bar') as {
          data: Uint8Array;
          hasFutureExpiry: number;
        };

        return {
          decoded: await decodeEntry(Buffer.from(row.data)),
          hasFutureExpiry: row.hasFutureExpiry,
        };
      });

      expect(res.decoded.value).toEqual({ foo: 'bar' });
      expect(res.hasFutureExpiry).toBe(1);
    });

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
        'Error while setting package cache value',
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
            'Error while setting package cache value',
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

    it('returns value from envelope payload', async () => {
      const res = await withSqlite(async (sqlite) => {
        insertRawCacheEntry(
          sqlite,
          'bar',
          await encodeEntry({ foo: 'bar' }, DateTime.local()),
        );

        return sqlite.get('_test-namespace', 'bar');
      });

      expect(res).toEqual({ foo: 'bar' });
    });

    // TODO: Delete this legacy raw-brotli read case once legacy.ts is removed.
    it('returns value from legacy raw-brotli payload without rewriting it', async () => {
      const res = await withSqlite(async (sqlite) => {
        const compressed = await brotliCompress(JSON.stringify({ foo: 'bar' }));
        insertRawCacheEntry(sqlite, 'bar', compressed);

        const value = await sqlite.get('_test-namespace', 'bar');
        const row = sqlite.client
          .prepare(
            'SELECT data FROM package_cache WHERE namespace = ? AND key = ?',
          )
          .get('_test-namespace', 'bar') as { data: Uint8Array };

        return { value, data: Buffer.from(row.data) };
      });

      expect(res.value).toEqual({ foo: 'bar' });
      // SQLite cleanup uses its expiry column, so it must not rewrite on read.
      expect(isEnvelope(res.data)).toBeFalse();
    });
  });

  describe('expiry', () => {
    it('deletes existing row for non-positive TTL', async () => {
      const res = await withSqlite(async (sqlite) => {
        await sqlite.set('_test-namespace', 'bar', 'value', 5);
        await sqlite.set('_test-namespace', 'bar', 'value', -1);
        const row = sqlite.client
          .prepare(
            'SELECT data FROM package_cache WHERE namespace = ? AND key = ?',
          )
          .get('_test-namespace', 'bar');

        return {
          value: await sqlite.get('_test-namespace', 'bar'),
          row,
        };
      });

      expect(res.value).toBeUndefined();
      expect(res.row).toBeUndefined();
    });
  });

  describe('destroy', () => {
    it('deletes expired rows and closes database', async () => {
      const res = await withSqliteDir(async (cacheDir) => {
        const client1 = await PackageCacheSqlite.create(cacheDir);
        insertRawCacheEntry(
          client1,
          'expired',
          await encodeEntry('old', DateTime.local()),
          -1,
        );
        await client1.set('_test-namespace', 'valid', 'fresh', 5);
        await client1.destroy();

        const client2 = await PackageCacheSqlite.create(cacheDir);
        const expired = await client2.get('_test-namespace', 'expired');
        const valid = await client2.get('_test-namespace', 'valid');
        const expiredRow = client2.client
          .prepare(
            'SELECT data FROM package_cache WHERE namespace = ? AND key = ?',
          )
          .get('_test-namespace', 'expired');
        await client2.destroy();

        return { expired, expiredRow, valid };
      });

      expect(res.expired).toBeUndefined();
      expect(res.expiredRow).toBeUndefined();
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
        expect(() => sqlite.client.prepare('SELECT 1').get()).toThrow(
          'database is not open',
        );
      });
    });

    it('resolves when close throws', async () => {
      await withSqliteDir(async (cacheDir) => {
        const sqlite = await PackageCacheSqlite.create(cacheDir);
        const closeSpy = vi
          .spyOn(sqlite.client, 'close')
          .mockImplementationOnce(() => {
            throw new Error('close failed');
          });

        try {
          await expect(sqlite.destroy()).resolves.toBeUndefined();

          expect(logger.warn).toHaveBeenCalledWith(
            { err: expect.any(Error) },
            'SQLite package cache close failed',
          );
        } finally {
          expect(sqlite.client.isOpen).toBe(true);
          closeSpy.mockRestore();
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
