import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { promisify } from 'node:util';
import zlib, { constants } from 'node:zlib';
import { exists } from 'fs-extra';
import upath from 'upath';
import { logger } from '../../../logger';
import { ensureDir } from '../../fs';
import type { PackageCacheNamespace } from './types';

const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

function compress(input: unknown): Promise<Buffer> {
  const jsonStr = JSON.stringify(input);
  return brotliCompress(jsonStr, {
    params: {
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
      [constants.BROTLI_PARAM_QUALITY]: 3,
    },
  });
}

async function decompress<T>(input: Buffer): Promise<T> {
  const buf = await brotliDecompress(input);
  const jsonStr = buf.toString('utf8');
  return JSON.parse(jsonStr) as T;
}

export class SqlitePackageCache {
  private readonly client: DatabaseSync;
  private readonly upsertStatement: StatementSync;
  private readonly getStatement: StatementSync;
  private readonly deleteExpiredRows: StatementSync;
  private readonly countStatement: StatementSync;

  static async init(cacheDir: string): Promise<SqlitePackageCache> {
    // simply let it throw if it fails, so no test coverage needed
    const sqliteDir = upath.join(cacheDir, 'renovate/renovate-cache-sqlite');
    await ensureDir(sqliteDir);
    const sqliteFile = upath.join(sqliteDir, 'db.sqlite');

    if (await exists(sqliteFile)) {
      logger.debug(`Using SQLite package cache: ${sqliteFile}`);
    } else {
      logger.debug(`Creating SQLite package cache: ${sqliteFile}`);
    }

    const client = new DatabaseSync(sqliteFile, { timeout: 30_000 });
    const res = new SqlitePackageCache(client);
    return res;
  }

  private constructor(client: DatabaseSync) {
    this.client = client;
    this.client.exec('PRAGMA journal_mode = WAL');
    this.client.exec("PRAGMA encoding = 'UTF-8'");

    this.client.exec(
      `
          CREATE TABLE IF NOT EXISTS package_cache (
            namespace TEXT NOT NULL,
            key TEXT NOT NULL,
            expiry INTEGER NOT NULL,
            data BLOB NOT NULL,
            PRIMARY KEY (namespace, key)
          )
        `,
    );
    this.client.exec(
      'CREATE INDEX IF NOT EXISTS expiry ON package_cache (expiry)',
    );
    this.client.exec(
      'CREATE INDEX IF NOT EXISTS namespace_key ON package_cache (namespace, key)',
    );

    this.upsertStatement = this.client.prepare(`
      INSERT INTO package_cache (namespace, key, data, expiry)
      VALUES (@namespace, @key, @data, unixepoch() + @ttlSeconds)
      ON CONFLICT (namespace, key) DO UPDATE SET
        data = @data,
        expiry = unixepoch() + @ttlSeconds
    `);

    this.getStatement = this.client.prepare(
      `
          SELECT data FROM package_cache
          WHERE
            namespace = @namespace AND key = @key AND expiry > unixepoch()
        `,
    );

    this.deleteExpiredRows = this.client.prepare(`
      DELETE FROM package_cache
      WHERE expiry <= unixepoch()
    `);

    this.countStatement = this.client.prepare(
      'SELECT COUNT(*) as total FROM package_cache',
    );
  }

  async set(
    namespace: PackageCacheNamespace,
    key: string,
    value: unknown,
    hardTtlMinutes = 5,
  ): Promise<void> {
    const data = await compress(value);
    const ttlSeconds = hardTtlMinutes * 60;
    this.upsertStatement.run({ namespace, key, data, ttlSeconds });
    return Promise.resolve();
  }

  async get<T = unknown>(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<T | undefined> {
    const data = this.getStatement.get({ namespace, key })?.data as
      | Buffer
      | undefined;

    if (!data) {
      return undefined;
    }

    return await decompress<T>(data);
  }

  private cleanupExpired(): void {
    const start = Date.now();
    // `COUNT(*)` is always returning a row
    const totalCount = this.countStatement.get()!.total as number;
    const { changes: deletedCount } = this.deleteExpiredRows.run();
    const finish = Date.now();
    const durationMs = finish - start;
    logger.debug(
      `SQLite package cache: deleted ${deletedCount} of ${totalCount} entries in ${durationMs}ms`,
    );
  }

  cleanup(): Promise<void> {
    this.cleanupExpired();
    this.client.close();
    return Promise.resolve();
  }
}
