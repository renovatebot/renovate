import Database from 'better-sqlite3';
import type { Database as DatabaseInstance } from 'better-sqlite3';

// db for strings
let stringsDb: DatabaseInstance | undefined;
// map for anything else
let cache: Map<string, any> | undefined;

export function init(): void {
  stringsDb = new Database(':memory:');
  stringsDb.exec(`
    CREATE TABLE IF NOT EXISTS repoCache (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  cache = new Map();
}

export function reset(): void {
  stringsDb?.close();
  stringsDb = undefined;
  cache = undefined;
}

export function get<T = any>(key: string): T {
  if (!stringsDb || !cache) {
    return undefined as T;
  }
  if (cache.has(key)) {
    return cache.get(key);
  }
  const row = stringsDb
    .prepare('SELECT value FROM repoCache WHERE key = ?')
    .get(key) as { value: string } | undefined;
  if (!row) {
    return undefined as T;
  }
  return row.value as T;
}

export function set(key: string, value: any): void {
  if (!stringsDb || !cache || value === null || value === undefined) {
    return;
  }
  if (typeof value !== 'string') {
    cache.set(key, value);
    return;
  }
  stringsDb
    .prepare(
      `
    INSERT INTO repoCache (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `,
    )
    .run(key, value);
}
