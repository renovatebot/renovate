import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { promisify } from 'node:util';
import zlib, { constants } from 'node:zlib';
import fs from 'fs-extra';
import upath from 'upath';
import { logger } from '../../../../logger/index.ts';
import { ensureDir } from '../../../fs/index.ts';
import type { PackageCacheNamespace } from '../types.ts';
import { PackageCacheBase } from './base.ts';

const { exists } = fs;
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

export class PackageCacheSqlite extends PackageCacheBase {
  private static readonly busyTimeoutMs = 100;

  static async create(cacheDir: string): Promise<PackageCacheSqlite> {
    const sqliteDir = upath.join(cacheDir, 'renovate/renovate-cache-sqlite');
    await ensureDir(sqliteDir);
    const sqliteFile = upath.join(sqliteDir, 'db.sqlite');

    if (await exists(sqliteFile)) {
      logger.debug(`Using SQLite package cache: ${sqliteFile}`);
    } else {
      logger.debug(`Creating SQLite package cache: ${sqliteFile}`);
    }

    const client = new DatabaseSync(sqliteFile, {
      timeout: PackageCacheSqlite.busyTimeoutMs,
    });
    return new PackageCacheSqlite(client);
  }

  private readonly upsertStatement: StatementSync;
  private readonly getStatement: StatementSync;
  private readonly deleteExpiredRows: StatementSync;
  private readonly countStatement: StatementSync;

  readonly client: DatabaseSync;

  private constructor(client: DatabaseSync) {
    super();
    this.client = client;
    client.exec('PRAGMA journal_mode = WAL');
    client.exec("PRAGMA encoding = 'UTF-8'");

    client.exec(
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
    client.exec('CREATE INDEX IF NOT EXISTS expiry ON package_cache (expiry)');
    client.exec(
      'CREATE INDEX IF NOT EXISTS namespace_key ON package_cache (namespace, key)',
    );

    this.upsertStatement = client.prepare(`
      INSERT INTO package_cache (namespace, key, data, expiry)
      VALUES (@namespace, @key, @data, unixepoch() + @ttlSeconds)
      ON CONFLICT (namespace, key) DO UPDATE SET
        data = @data,
        expiry = unixepoch() + @ttlSeconds
    `);

    this.getStatement = client.prepare(
      `
          SELECT data FROM package_cache
          WHERE
            namespace = @namespace AND key = @key AND expiry > unixepoch()
        `,
    );

    this.deleteExpiredRows = client.prepare(`
      DELETE FROM package_cache
      WHERE expiry <= unixepoch()
    `);

    this.countStatement = client.prepare(
      'SELECT COUNT(*) as total FROM package_cache',
    );
  }

  override async set(
    namespace: PackageCacheNamespace,
    key: string,
    value: unknown,
    hardTtlMinutes: number,
  ): Promise<void> {
    try {
      const compressedData = await compress(value);
      const ttlSeconds = hardTtlMinutes * 60;
      this.upsertStatement.run({
        namespace,
        key,
        data: compressedData,
        ttlSeconds,
      });
    } catch (err) {
      logger.once.warn({ err }, 'Error while setting SQLite cache value');
    }
  }

  override async get<T = unknown>(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<T | undefined> {
    try {
      const data = this.getStatement.get({ namespace, key })?.data as
        | Buffer
        | undefined;

      if (!data) {
        logger.trace({ namespace, key }, 'Cache miss');
        return undefined;
      }

      return await decompress<T>(data);
    } catch (err) {
      logger.once.warn({ err }, 'Error while reading SQLite cache value');
      return undefined;
    }
  }

  override destroy(): Promise<void> {
    try {
      const startTime = Date.now();
      // `COUNT(*)` is always returning a row
      const totalCount = this.countStatement.get()!.total as number;
      const { changes: deletedCount } = this.deleteExpiredRows.run();
      const durationMs = Date.now() - startTime;
      logger.debug(
        `SQLite package cache: deleted ${deletedCount} of ${totalCount} entries in ${durationMs}ms`,
      );
    } catch (err) {
      logger.warn({ err }, 'SQLite package cache cleanup failed');
    }

    try {
      this.client.close();
    } catch (err) {
      logger.warn({ err }, 'SQLite package cache close failed');
    }

    return Promise.resolve();
  }
}
