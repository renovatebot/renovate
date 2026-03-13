import { randomUUID } from 'node:crypto';
import { createGunzip } from 'node:zlib';
import upath from 'upath';
import { logger } from '../../../../logger/index.ts';
import * as fs from '../../../../util/fs/index.ts';
import { toSha256 } from '../../../../util/hash.ts';
import type { Http, HttpOptions } from '../../../../util/http/index.ts';
import { acquireLock } from '../../../../util/mutex.ts';
import type { ReleaseResult } from '../../types.ts';
import { datasource } from '../common.ts';

const cacheSubDir = datasource;

type RpmVersionValue = boolean | number | string | null | undefined;

export function formatRpmVersion(
  ver: RpmVersionValue,
  rel?: RpmVersionValue,
): string | null {
  if (ver === undefined || ver === null) {
    return null;
  }

  const version = `${ver}`;

  if (rel === undefined || rel === null) {
    return version;
  }

  return `${version}-${rel}`;
}

export function buildReleaseResult(
  versions: Iterable<string>,
): ReleaseResult | null {
  const uniqueVersions = [...new Set(versions)];

  if (uniqueVersions.length === 0) {
    return null;
  }

  return {
    releases: uniqueVersions.map((version) => ({ version })),
  };
}

async function getFileCreationTime(
  filePath: string,
): Promise<Date | undefined> {
  const stats = await fs.statCacheFile(filePath);
  return stats?.ctime;
}

async function checkIfModified(
  url: string,
  lastDownloadTimestamp: Date,
  http: Http,
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
      {
        err,
        lastDownloadTimestamp,
        url,
      },
      'Could not determine if metadata file is modified since last download',
    );
    return true;
  }
}

async function downloadGzipFile(
  url: string,
  compressedFile: string,
  http: Http,
  lastDownloadTimestamp?: Date,
): Promise<boolean> {
  let needsToDownload = true;

  if (lastDownloadTimestamp) {
    needsToDownload = await checkIfModified(url, lastDownloadTimestamp, http);
  }

  if (!needsToDownload) {
    logger.debug(`No need to download ${url}, file is up to date.`);
    return false;
  }

  const readStream = http.stream(url);
  const writeStream = fs.createCacheWriteStream(compressedFile);
  await fs.pipeline(readStream, writeStream);

  const compressedStats = await fs.statCacheFile(compressedFile);
  if (!compressedStats || compressedStats.size === 0) {
    logger.debug(`Empty response body from getting ${url}.`);
    throw new Error(`Empty response body from getting ${url}.`);
  }

  return true;
}

async function extractGzipFile(
  compressedFile: string,
  extractedFile: string,
): Promise<void> {
  await fs.pipeline(
    fs.createCacheReadStream(compressedFile),
    createGunzip(),
    fs.createCacheWriteStream(extractedFile),
  );
}

export async function getCachedGunzippedFile(
  http: Http,
  url: string,
  extension: 'sqlite' | 'xml',
): Promise<string> {
  const releaseLock = await acquireLock(
    `gunzipped-file:${url}:${extension}`,
    'datasource-rpm',
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
      const wasUpdated = await downloadGzipFile(
        url,
        compressedFile,
        http,
        lastTimestamp,
      );

      if (wasUpdated || !lastTimestamp) {
        try {
          // Only replace the shared cache file after a successful extract.
          await extractGzipFile(compressedFile, extractedTempFile);
          await fs.renameCacheFile(extractedTempFile, extractedFile);
          lastTimestamp = await getFileCreationTime(extractedFile);
        } catch (err) {
          logger.warn(
            {
              compressedFile,
              err,
              extension,
              extractedFile,
              url,
            },
            'Failed to extract RPM metadata file from compressed file',
          );
        }
      }

      if (!lastTimestamp) {
        throw new Error('Missing metadata in extracted RPM metadata file!');
      }

      return extractedFile;
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
