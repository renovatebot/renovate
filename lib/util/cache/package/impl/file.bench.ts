import cacache from 'cacache';
import { DateTime } from 'luxon';
import { type DirectoryResult, dir } from 'tmp-promise';
import upath from 'upath';
import { bench, describe } from 'vitest';
import { PackageCacheFile } from './file.ts';

/**
 * Benchmark for PackageCacheFile.destroy() comparing:
 * - Cold path: entries only on disk, destroy() must read each entry to check expiry
 * - Warm path: entries written via set(), expiryMap populated, destroy() skips disk reads
 *
 * Valid entries are NOT deleted by destroy(), so pre-populated data persists
 * across iterations — allowing accurate measurement of just the destroy() call.
 *
 * Run with:
 *   pnpm vitest:bench lib/util/cache/package/impl/file.bench.ts
 */

const ENTRY_COUNT = 2000;

async function setupColdCache(): Promise<{
  tmpDir: DirectoryResult;
  cache: PackageCacheFile;
}> {
  const tmpDir = await dir({ unsafeCleanup: true });
  const cacheFileName = upath.join(tmpDir.path, '/renovate/renovate-cache-v1');
  const expiry = DateTime.local().plus({ minutes: 60 }).toISO();
  for (let i = 0; i < ENTRY_COUNT; i++) {
    await cacache.put(
      cacheFileName,
      `namespace-key-${i}`,
      JSON.stringify({ compress: false, value: i, expiry }),
    );
  }
  // Fresh instance: empty expiryMap (simulates a new process reading old cache)
  const cache = PackageCacheFile.create(tmpDir.path);
  return { tmpDir, cache };
}

async function setupWarmCache(): Promise<{
  tmpDir: DirectoryResult;
  cache: PackageCacheFile;
}> {
  const tmpDir = await dir({ unsafeCleanup: true });
  const cache = PackageCacheFile.create(tmpDir.path);
  for (let i = 0; i < ENTRY_COUNT; i++) {
    await cache.set('_test-namespace', `key-${i}`, i, 60);
  }
  return { tmpDir, cache };
}

describe('PackageCacheFile destroy()', () => {
  // Lazily initialized on first bench iteration, reused across all subsequent ones.
  // Valid entries are not deleted by destroy(), so the cache stays populated.
  let cold: { tmpDir: DirectoryResult; cache: PackageCacheFile } | undefined;
  let warm: { tmpDir: DirectoryResult; cache: PackageCacheFile } | undefined;

  bench('cold path — no expiryMap (disk read per entry)', async () => {
    cold ??= await setupColdCache();
    // New instance each time so expiryMap is empty — forces disk reads
    cold.cache = PackageCacheFile.create(cold.tmpDir.path);
    await cold.cache.destroy();
  });

  bench(
    'warm path — expiryMap populated via set() (no disk read)',
    async () => {
      warm ??= await setupWarmCache();
      // Reuse same instance so expiryMap stays populated — skips disk reads
      await warm.cache.destroy();
    },
  );
});
