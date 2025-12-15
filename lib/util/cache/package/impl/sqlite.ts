import { promisify } from 'node:util';
import zlib, { constants } from 'node:zlib';
import type { Database, Statement } from 'better-sqlite3';
import { exists } from 'fs-extra';
import upath from 'upath';
import { sqlite } from '../../../../expose.cjs';
import { logger } from '../../../../logger';
import { ensureDir } from '../../../fs';
import type { PackageCacheNamespace } from '../types';
import { PackageCacheBase } from './base';

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
    return new PackageCacheSqlite(client);
  }

  private upsertStatement: Statement<unknown[]>;
  private getStatement: Statement<unknown[]>;
  private deleteExpiredRows: Statement<unknown[]>;
  private countStatement: Statement<unknown[]>;

  private constructor(private readonly client: Database) {
    super();
    this.client.pragma('journal_mode = WAL');
    this.client.pragma("encoding = 'UTF-8'");

    this.client
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
    this.client
      .prepare('CREATE INDEX IF NOT EXISTS expiry ON package_cache (expiry)')
      .run();
    this.client
      .prepare(
        'CREATE INDEX IF NOT EXISTS namespace_key ON package_cache (namespace, key)',
      )
      .run();

    this.upsertStatement = this.client.prepare(`
      INSERT INTO package_cache (namespace, key, data, expiry)
      VALUES (@namespace, @key, @data, unixepoch() + @ttlSeconds)
      ON CONFLICT (namespace, key) DO UPDATE SET
        data = @data,
        expiry = unixepoch() + @ttlSeconds
    `);

    this.getStatement = this.client
      .prepare(
        `
          SELECT data FROM package_cache
          WHERE
            namespace = @namespace AND key = @key AND expiry > unixepoch()
        `,
      )
      .pluck(true);

    this.deleteExpiredRows = this.client.prepare(`
      DELETE FROM package_cache
      WHERE expiry <= unixepoch()
    `);

    this.countStatement = this.client
      .prepare('SELECT COUNT(*) FROM package_cache')
      .pluck(true);
  }

  async set<T = unknown>(
    namespace: PackageCacheNamespace,
    key: string,
    value: T,
    hardTtlMinutes: number,
  ): Promise<void> {
    const data = await compress(value);
    const ttlSeconds = hardTtlMinutes * 60;
    this.upsertStatement.run({ namespace, key, data, ttlSeconds });
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

  override destroy(): Promise<void> {
    const start = Date.now();
    const totalCount = this.countStatement.get() as number;
    const { changes: deletedCount } = this.deleteExpiredRows.run();
    const finish = Date.now();
    const durationMs = finish - start;
    logger.debug(
      `SQLite package cache: deleted ${deletedCount} of ${totalCount} entries in ${durationMs}ms`,
    );
    this.client.close();
    return Promise.resolve();
  }
}
