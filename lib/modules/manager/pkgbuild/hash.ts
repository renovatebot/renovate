import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import * as fs from '../../../util/fs/index.ts';
import { ensureCacheDir } from '../../../util/fs/index.ts';
import { hashStream } from '../../../util/hash.ts';
import { Http } from '../../../util/http/index.ts';
import type { ChecksumData } from './types.ts';

const http = new Http('pkgbuild');

const hashCacheTTL = 10080; // in minutes == 1 week

/**
 * Download file and compute checksums (internal implementation)
 * Downloads the file once to cache, then computes all hashes via streams
 */
async function _computeChecksums(url: string): Promise<ChecksumData> {
  // Get cache directory for temporary file storage
  const cacheDir = await ensureCacheDir('pkgbuild');
  const fileName =
    new URL(url).pathname.split('/').findLast(Boolean) ?? 'download';
  const downloadPath = upath.join(cacheDir, fileName);

  logger.debug(
    { url, downloadPath },
    'Downloading file for checksum computation',
  );

  // Download file once to cache
  const readStream = http.stream(url);
  const writeStream = fs.createCacheWriteStream(downloadPath);

  try {
    await fs.pipeline(readStream, writeStream);

    // Compute all hashes from cached file via streams (avoids loading into memory)
    const [sha256, sha512, b2, md5] = await Promise.all([
      hashStream(fs.createCacheReadStream(downloadPath), 'sha256'),
      hashStream(fs.createCacheReadStream(downloadPath), 'sha512'),
      hashStream(fs.createCacheReadStream(downloadPath), 'blake2b512'),
      hashStream(fs.createCacheReadStream(downloadPath), 'md5'),
    ]);

    const checksums: ChecksumData = { sha256, sha512, b2, md5 };
    logger.debug({ checksums }, 'Computed checksums for new version');
    return checksums;
  } finally {
    await fs.rmCache(downloadPath);
  }
}

/**
 * Download file and compute checksums with caching
 * Results are cached by URL to avoid repeated downloads
 */
export function computeChecksums(url: string): Promise<ChecksumData> {
  return withCache(
    {
      namespace: 'pkgbuild-hash',
      key: `computeChecksums:${url}`,
      ttlMinutes: hashCacheTTL,
    },
    () => _computeChecksums(url),
  );
}
