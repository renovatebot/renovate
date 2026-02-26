import { promisify } from 'node:util';
import zlib, { constants } from 'node:zlib';
import type { Database, Statement } from 'better-sqlite3';
import fs from 'fs-extra';
import upath from 'upath';
import { sqlite } from '../../../../expose.ts';
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
  static async create(cacheDir: string): Promise<PackageCacheSqlite> {
    const Sqlite = await sqlite();
    const sqliteDir = upath.join(cacheDir, 'renovate/renovate-cache-sqlite');
    await ensureDir(sqliteDir);
    const sqliteFile = upath.join(sqliteDir, 'db.sqlite');

    if (await exists(sqliteFile)) {
      logger.debug(`Using SQLite package cache: ${sqliteFile}`);
    } else {
      logger.debug(`Creating SQLite package cache: ${sqliteFile}`);
    }

    const client = new Sqlite(sqliteFile);
    return new PackageCacheSqlite(client);
  }

  private readonly upsertStatement: Statement<unknown[]>;
  private readonly getStatement: Statement<unknown[]>;
  private readonly deleteExpiredRows: Statement<unknown[]>;
  private readonly countStatement: Statement<unknown[]>;

  private readonly client: Database;

  private constructor(client: Database) {
    super();
    this.client = client;

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

  override async set(
    namespace: PackageCacheNamespace,
    key: string,
    value: unknown,
    hardTtlMinutes: number,
  ): Promise<void> {
    const compressedData = await compress(value);
    const ttlSeconds = hardTtlMinutes * 60;
    this.upsertStatement.run({
      namespace,
      key,
      data: compressedData,
      ttlSeconds,
    });
  }

  override async get<T = unknown>(
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

  override destroy(): Promise<void> {
    const startTime = Date.now();
    const totalCount = this.countStatement.get() as number;
    const { changes: deletedCount } = this.deleteExpiredRows.run();
    const durationMs = Date.now() - startTime;
    logger.debug(
      `SQLite package cache: deleted ${deletedCount} of ${totalCount} entries in ${durationMs}ms`,
    );
    this.client.close();
    return Promise.resolve();
  }
}
