import type { DatabaseSync, StatementSync } from 'node:sqlite';
import fs from 'fs-extra';
import upath from 'upath';
import { logger } from '../../../../logger/index.ts';
import { getEnv } from '../../../env.ts';
import { ensureDir } from '../../../fs/index.ts';
import { parseInteger } from '../../../number.ts';
import type { PackageCacheNamespace } from '../types.ts';
import { PackageCacheBase } from './base.ts';

const { exists } = fs;

export class PackageCacheSqlite extends PackageCacheBase {
  static async create(cacheDir: string): Promise<PackageCacheSqlite> {
    const { DatabaseSync: Sqlite } = await import('node:sqlite');
    const sqliteDir = upath.join(cacheDir, 'renovate/renovate-cache-sqlite');
    await ensureDir(sqliteDir);
    const sqliteFile = upath.join(sqliteDir, 'db.sqlite');

    if (await exists(sqliteFile)) {
      logger.debug(`Using SQLite package cache: ${sqliteFile}`);
    } else {
      logger.debug(`Creating SQLite package cache: ${sqliteFile}`);
    }

    const { RENOVATE_X_SQLITE_BUSY_TIMEOUT } = getEnv();
    const timeout = parseInteger(RENOVATE_X_SQLITE_BUSY_TIMEOUT, 5000);

    const client = new Sqlite(sqliteFile, { timeout });
    return new PackageCacheSqlite(client);
  }

  private readonly upsertStatement: StatementSync;
  private readonly getStatement: StatementSync;
  private readonly deleteStatement: StatementSync;
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

    this.deleteStatement = client.prepare(`
      DELETE FROM package_cache
      WHERE namespace = @namespace AND key = @key
    `);

    this.deleteExpiredRows = client.prepare(`
      DELETE FROM package_cache
      WHERE expiry <= unixepoch()
    `);

    this.countStatement = client.prepare(
      'SELECT COUNT(*) as total FROM package_cache',
    );
  }

  protected override writeRaw(
    namespace: PackageCacheNamespace,
    key: string,
    data: Buffer,
    ttlSeconds: number,
  ): void {
    this.upsertStatement.run({
      namespace,
      key,
      data,
      ttlSeconds,
    });
  }

  protected override readRaw(
    namespace: PackageCacheNamespace,
    key: string,
  ): Buffer | undefined {
    const row = this.getStatement.get({ namespace, key }) as
      | { data: Uint8Array }
      | undefined;

    if (!row) {
      return undefined;
    }

    // `Buffer.from(row.data)` copies the whole payload.
    // This call does zero copy.
    return Buffer.from(
      row.data.buffer,
      row.data.byteOffset,
      row.data.byteLength,
    );
  }

  protected override rm(namespace: PackageCacheNamespace, key: string): void {
    logger.trace({ namespace, key }, 'Removing cache entry');
    this.deleteStatement.run({ namespace, key });
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
