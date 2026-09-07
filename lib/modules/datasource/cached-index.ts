import { randomUUID } from 'node:crypto';
import { createGunzip } from 'node:zlib';
import upath from 'upath';
import { logger } from '../../logger/index.ts';
import * as fs from '../../util/fs/index.ts';
import { toSha256 } from '../../util/hash.ts';
import type { Http, HttpOptions } from '../../util/http/index.ts';
import { acquireLock } from '../../util/mutex.ts';
import type { CachedIndexFile, CachedIndexOptions } from './types.ts';

const lockNamespace = 'datasource-cached-index';

/**
 * Checks if the file exists and retrieves its creation time.
 */
async function getFileCreationTime(
  filePath: string,
): Promise<Date | undefined> {
  const stats = await fs.statCacheFile(filePath);
  return stats?.ctime;
}

/**
 * Checks whether the URL content has been modified since the given timestamp.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Modified-Since
 */
async function checkIfModified(
  http: Http,
  url: string,
  lastDownloadTimestamp: Date,
): Promise<boolean> {
  const options: HttpOptions = {
    headers: {
      'If-Modified-Since': lastDownloadTimestamp.toUTCString(),
    },
  };

  try {
    const response = await http.head(url, options);
    return response.statusCode !== 304;
  } catch (err) {
    logger.warn(
      { err, lastDownloadTimestamp, url },
      'Could not determine if index file is modified since last download',
    );
    // Assume it needs to be downloaded if the check fails
    return true;
  }
}

/**
 * Downloads the URL unless the server reports it as unmodified.
 *
 * @returns `true` if the file was downloaded, otherwise `false`.
 */
async function downloadFile(
  http: Http,
  url: string,
  compressedFile: string,
  lastDownloadTimestamp: Date | undefined,
): Promise<boolean> {
  if (
    lastDownloadTimestamp &&
    !(await checkIfModified(http, url, lastDownloadTimestamp))
  ) {
    logger.debug(`No need to download ${url}, file is up to date.`);
    return false;
  }

  logger.debug({ url, targetFile: compressedFile }, 'Downloading index file');
  await fs.pipeline(
    http.stream(url),
    fs.createCacheWriteStream(compressedFile),
  );

  const compressedStats = await fs.statCacheFile(compressedFile);
  if (!compressedStats || compressedStats.size === 0) {
    throw new Error(`Empty response body from getting ${url}.`);
  }

  return true;
}

async function gunzipFile(
  compressedFile: string,
  extractedFile: string,
): Promise<void> {
  await fs.pipeline(
    fs.createCacheReadStream(compressedFile),
    createGunzip(),
    fs.createCacheWriteStream(extractedFile),
  );
}

/**
 * Downloads a gzipped index file and keeps the extracted content in the
 * Renovate cache dir, so that repeated lookups against the same registry reuse
 * it instead of downloading it again.
 *
 * The download is skipped when the server answers the `If-Modified-Since`
 * request with `304`, and the cached file is only replaced once a fresh
 * download has been extracted successfully.
 */
export async function getCachedGunzippedFile(
  http: Http,
  url: string,
  options: CachedIndexOptions,
): Promise<CachedIndexFile> {
  const { beforeExtract, cacheSubDir, description, extension } = options;

  const releaseLock = await acquireLock(
    `${cacheSubDir}:${url}:${extension}`,
    lockNamespace,
  );

  try {
    const cacheDir = await fs.ensureCacheDir(cacheSubDir);
    const urlHash = toSha256(url);
    const extractedFile = upath.join(cacheDir, `${urlHash}.${extension}`);
    let lastTimestamp = await getFileCreationTime(extractedFile);

    const compressedFile = upath.join(
      cacheDir,
      `${randomUUID()}_${urlHash}.gz`,
    );
    const extractedTempFile = upath.join(
      cacheDir,
      `${randomUUID()}_${urlHash}.${extension}`,
    );

    try {
      const wasUpdated = await downloadFile(
        http,
        url,
        compressedFile,
        lastTimestamp,
      );

      if (wasUpdated) {
        await beforeExtract?.(compressedFile);

        try {
          // Only replace the shared cache file after a successful extract.
          await gunzipFile(compressedFile, extractedTempFile);
          await fs.renameCacheFile(extractedTempFile, extractedFile);
          lastTimestamp = await getFileCreationTime(extractedFile);
        } catch (err) {
          logger.warn(
            { compressedFile, err, extension, extractedFile, url },
            'Failed to extract index file from compressed file',
          );
        }
      }

      if (!lastTimestamp) {
        throw new Error(`Missing metadata in extracted ${description}!`);
      }

      return { extractedFile, lastTimestamp };
    } finally {
      if (await fs.cachePathExists(compressedFile)) {
        await fs.rmCache(compressedFile);
      }
      if (await fs.cachePathExists(extractedTempFile)) {
        await fs.rmCache(extractedTempFile);
      }
    }
  } finally {
    releaseLock();
  }
}
