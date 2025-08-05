import { promisify } from 'node:util';
import zlib, { constants } from 'node:zlib';
import type { Database, Statement } from 'better-sqlite3';
import { exists } from 'fs-extra';
import upath from 'upath';
import { sqlite } from '../../../expose.cjs';
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
  private readonly upsertStatement: Statement<unknown[]>;
  private readonly getStatement: Statement<unknown[]>;
  private readonly deleteExpiredRows: Statement<unknown[]>;
  private readonly countStatement: Statement<unknown[]>;

  static async init(cacheDir: string): Promise<SqlitePackageCache> {
    // simply let it throw if it fails, so no test coverage needed
    const Sqlite = sqlite();
    const sqliteDir = upath.join(cacheDir, 'renovate/renovate-cache-sqlite');
    await ensureDir(sqliteDir);
    const sqliteFile = upath.join(sqliteDir, 'db.sqlite');

    if (await exists(sqliteFile)) {
      logger.debug(`Using SQLite package cache: ${sqliteFile}`);
    } else {
      logger.debug(`Creating SQLite package cache: ${sqliteFile}`);
    }

    const client = new Sqlite(sqliteFile);
    const res = new SqlitePackageCache(client);
    return res;
  }

  private constructor(private client: Database) {
    client.pragma('journal_mode = WAL');
    client.pragma("encoding = 'UTF-8'");

    client
      .prepare(
        `
          CREATE TABLE IF NOT EXISTS package_cache (
            namespace TEXT NOT NULL,
            key TEXT NOT NULL,
            expiry INTEGER NOT NULL,
            data BLOB NOT NULL,
            PRIMARY KEY (namespace, key)
          )
        `,
      )
      .run();
    client
      .prepare('CREATE INDEX IF NOT EXISTS expiry ON package_cache (expiry)')
      .run();
    client
      .prepare(
        'CREATE INDEX IF NOT EXISTS namespace_key ON package_cache (namespace, key)',
      )
      .run();

    this.upsertStatement = client.prepare(`
      INSERT INTO package_cache (namespace, key, data, expiry)
      VALUES (@namespace, @key, @data, unixepoch() + @ttlSeconds)
      ON CONFLICT (namespace, key) DO UPDATE SET
        data = @data,
        expiry = unixepoch() + @ttlSeconds
    `);

    this.getStatement = client
      .prepare(
        `
          SELECT data FROM package_cache
          WHERE
            namespace = @namespace AND key = @key AND expiry > unixepoch()
        `,
      )
      .pluck(true);

    this.deleteExpiredRows = client.prepare(`
      DELETE FROM package_cache
      WHERE expiry <= unixepoch()
    `);

    this.countStatement = client
      .prepare('SELECT COUNT(*) FROM package_cache')
      .pluck(true);
  }

  async set(
    namespace: PackageCacheNamespace,
    key: string,
    value: unknown,
    ttlMinutes = 5,
  ): Promise<void> {
    const data = await compress(value);
    const ttlSeconds = ttlMinutes * 60;
    this.upsertStatement.run({ namespace, key, data, ttlSeconds });
    return Promise.resolve();
  }

  async get<T = unknown>(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<T | undefined> {
    const data = this.getStatement.get({ namespace, key }) as
      | Buffer
      | undefined;

    if (!data) {
      return undefined;
    }

    return await decompress<T>(data);
  }

  private cleanupExpired(): void {
    const start = Date.now();
    const totalCount = this.countStatement.get() as number;
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
