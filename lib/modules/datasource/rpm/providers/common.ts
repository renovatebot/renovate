import { randomUUID } from 'node:crypto';
import type { Transform } from 'node:stream';
import { createGunzip, createZstdDecompress } from 'node:zlib';
import { isNullOrUndefined } from '@sindresorhus/is';
import upath from 'upath';
import { logger } from '../../../../logger/index.ts';
import * as fs from '../../../../util/fs/index.ts';
import { toSha256 } from '../../../../util/hash.ts';
import type { Http, HttpOptions } from '../../../../util/http/index.ts';
import { acquireLock } from '../../../../util/mutex.ts';
import { parseUrl } from '../../../../util/url.ts';
import type { ReleaseResult } from '../../types.ts';
import { datasource } from '../common.ts';

const cacheSubDir = datasource;

type RpmVersionValue = boolean | number | string | null | undefined;

export function formatRpmVersion(
  ver: RpmVersionValue,
  rel?: RpmVersionValue,
): string | null {
  if (isNullOrUndefined(ver)) {
    return null;
  }

  const version = String(ver);

  if (isNullOrUndefined(rel)) {
    return version;
  }

  return `${version}-${String(rel)}`;
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

async function downloadFileToCache(
  url: string,
  cachePath: string,
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
  const writeStream = fs.createCacheWriteStream(cachePath);
  await fs.pipeline(readStream, writeStream);

  const compressedStats = await fs.statCacheFile(cachePath);
  if (!compressedStats || compressedStats.size === 0) {
    logger.debug(`Empty response body from getting ${url}.`);
    throw new Error(`Empty response body from getting ${url}.`);
  }

  return true;
}

function getFileExtension(pathname: string): string {
  const start = pathname.lastIndexOf('.');

  if (start === -1) {
    return '';
  }

  return pathname.slice(start);
}

// https://github.com/rpm-software-management/libsolv/blob/a8a2de8947beeb56cd7b97d1e4afb1a2e4515a43/ext/solv_xfopen.c#L607-L656
const decompressors: Record<string, () => Transform | never> = {
  '.gz': createGunzip,
  '.xz': () => {
    throw new Error('LZMA compression is not supported');
  },
  '.lzma': () => {
    throw new Error('LZMA compression is not supported');
  },
  '.bz2': () => {
    throw new Error('BZip2 compression is not supported');
  },
  '.zst': createZstdDecompress,
  '.zck': () => {
    throw new Error('ZChunk compression is not supported');
  },
};

async function decompressFile(
  compressedFile: string,
  decompressedFile: string,
): Promise<void> {
  const decompressor = decompressors[getFileExtension(compressedFile)];

  if (!decompressor) {
    await fs.renameCacheFile(compressedFile, decompressedFile);
    return;
  }

  await fs.pipeline(
    fs.createCacheReadStream(compressedFile),
    decompressor(),
    fs.createCacheWriteStream(decompressedFile),
  );
}

export async function getCachedDecompressedFile(
  http: Http,
  url: string,
  extension: 'xml',
): Promise<string> {
  const releaseLock = await acquireLock(
    `decompressed-file:${url}:${extension}`,
    'datasource-rpm',
  );

  try {
    const cacheDir = await fs.ensureCacheDir(cacheSubDir);
    const urlHash = toSha256(url);
    const decompressedFile = upath.join(cacheDir, `${urlHash}.${extension}`);
    let lastTimestamp = await getFileCreationTime(decompressedFile);
    const urlParsed = parseUrl(url);

    if (!urlParsed) {
      throw new Error('Cannot parse URL');
    }

    const compressedFile = upath.join(
      cacheDir,
      `${randomUUID()}_${urlHash}${getFileExtension(urlParsed.pathname)}`,
    );
    const decompressedTempFile = upath.join(
      cacheDir,
      `${randomUUID()}_${urlHash}.${extension}`,
    );

    try {
      const wasUpdated = await downloadFileToCache(
        url,
        compressedFile,
        http,
        lastTimestamp,
      );

      if (wasUpdated || !lastTimestamp) {
        try {
          // Only replace the shared cache file after a successful decompress.
          await decompressFile(compressedFile, decompressedTempFile);
          await fs.renameCacheFile(decompressedTempFile, decompressedFile);
          lastTimestamp = await getFileCreationTime(decompressedFile);
        } catch (err) {
          logger.warn(
            {
              compressedFile,
              err,
              extension,
              decompressedFile,
              url,
            },
            'Failed to extract RPM metadata file from compressed file',
          );
          if (!lastTimestamp) {
            throw err;
          }
        }
      }

      if (!lastTimestamp) {
        throw new Error('Missing metadata in extracted RPM metadata file!');
      }

      return decompressedFile;
    } finally {
      if (await fs.cachePathExists(compressedFile)) {
        await fs.rmCache(compressedFile);
      }
      if (await fs.cachePathExists(decompressedTempFile)) {
        await fs.rmCache(decompressedTempFile);
      }
    }
  } finally {
    releaseLock();
  }
}
