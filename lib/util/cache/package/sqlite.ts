import Sqlite from 'better-sqlite3';
import type { Database, Statement } from 'better-sqlite3';
import { DateTime } from 'luxon';
import * as upath from 'upath';
import { logger } from '../../../logger';
import { ensureDir } from '../../fs';

export class SqlitePackageCache {
  private readonly upsertStatement: Statement<unknown[]>;
  private readonly getStatement: Statement<unknown[]>;
  private readonly cleanupStatement: Statement<unknown[]>;

  static async init(cacheDir: string): Promise<SqlitePackageCache> {
    const sqliteDir = upath.join(cacheDir, '/renovate/renovate-cache-sqlite');
    await ensureDir(sqliteDir);
    const sqliteFile = upath.join(sqliteDir, 'db.sqlite');
    const client = new Sqlite(sqliteFile);
    const res = new SqlitePackageCache(client);
    res.cleanup();
    return res;
  }

  private constructor(private client: Database) {
    client.pragma('journal_mode = WAL');
    client.pragma("encoding = 'UTF-8'");

    client
      .prepare(
        `
          CREATE TABLE IF NOT EXISTS cache (
            namespace TEXT NOT NULL,
            key TEXT NOT NULL,
            data TEXT NOT NULL,
            expiry INTEGER NOT NULL,
            PRIMARY KEY (namespace, key)
          )
        `,
      )
      .run();
    client.prepare('CREATE INDEX IF NOT EXISTS expiry ON cache (expiry)').run();
    client
      .prepare(
        'CREATE INDEX IF NOT EXISTS namespace_key ON cache (namespace, key)',
      )
      .run();

    this.upsertStatement = client.prepare(`
      INSERT INTO cache (namespace, key, data, expiry)
      VALUES (@namespace, @key, @data, @expiry)
      ON CONFLICT (namespace, key) DO UPDATE SET
        data = @data,
        expiry = @expiry
    `);

    this.getStatement = client
      .prepare(
        `
          SELECT data FROM cache
          WHERE
            namespace = @namespace AND key = @key
        `,
      )
      .pluck(true);

    this.cleanupStatement = client.prepare(`
      DELETE FROM cache
      WHERE expiry <= @now
    `);
  }

  set(namespace: string, key: string, value: unknown, ttlMinutes = 5): void {
    const data = JSON.stringify(value);
    const expiry = DateTime.utc().plus({ minutes: ttlMinutes }).toMillis();
    this.upsertStatement.run({ namespace, key, data, expiry });
  }

  get<T = never>(namespace: string, key: string): T | undefined {
    const res = this.getStatement.get({ namespace, key }) as string | undefined;
    return res ? JSON.parse(res) : undefined;
  }

  private cleanup(): void {
    const now = DateTime.utc().toMillis();
    this.cleanupStatement.run({ now });
    const timeMs = DateTime.utc().toMillis() - now;
    logger.trace(`SQLite cache cleanup: ${timeMs}ms`);
  }

  close(): void {
    this.client.close();
  }
}
