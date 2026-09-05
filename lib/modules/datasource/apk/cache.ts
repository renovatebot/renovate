import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { extract as tarExtract } from 'tar';
import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import * as fs from '../../../util/fs/index.ts';
import { toSha256 } from '../../../util/hash.ts';
import type { Http } from '../../../util/http/index.ts';
import type { OutgoingHttpHeaders } from '../../../util/http/types.ts';
import { Json } from '../../../util/schema-utils/index.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { ApkIndexCache } from './schema.ts';

const cacheSubDir = 'apk';
const archiveFileName = 'APKINDEX.tar.gz';
const indexFileName = 'APKINDEX';
const cacheFileName = 'APKINDEX.cache.json';

/**
 * Downloads and extracts `APKINDEX.tar.gz` for a component, or return the path to the cached version if it is still current.
 *
 * Alongside the extracted archive, we also store the `ETag` and `Last-Modified` to allow re-using them on subsequent requests.
 *
 * The extracted index (and the cache headers) are only ever kept on-disk, rather than in the package cache, due to their size.
 *
 * @param http - The HTTP client to download with.
 * @param componentUrl - The `APKINDEX` directory URL of the component.
 * @returns The path of the extracted `APKINDEX`, or `null` when the archive holds no index.
 */
export async function getIndexFile(
  http: Http,
  componentUrl: string,
): Promise<string | null> {
  const componentCacheDir = upath.join(cacheSubDir, toSha256(componentUrl));
  const componentDir = await fs.ensureCacheDir(componentCacheDir);
  const indexFile = upath.join(componentDir, indexFileName);
  const cacheFile = upath.join(componentDir, cacheFileName);

  const cached = await readIndexCache(cacheFile, indexFile);

  const indexUrl = joinUrlParts(componentUrl, archiveFileName);
  const extractDir = await fs.ensureCacheDir(
    upath.join(componentCacheDir, randomUUID()),
  );

  try {
    const archiveFile = upath.join(extractDir, archiveFileName);
    const { statusCode, etag, lastModified } = await downloadArchive(
      http,
      indexUrl,
      archiveFile,
      cached,
    );

    if (cached && statusCode === 304) {
      logger.debug(`APK index ${indexUrl} is unchanged, using the cached copy`);
      return indexFile;
    }

    await tarExtract({
      file: archiveFile,
      cwd: extractDir,
      filter: (path) => upath.basename(path) === indexFileName,
    });

    const extractedFile = upath.join(extractDir, indexFileName);
    if (!(await fs.cachePathIsFile(extractedFile))) {
      logger.warn({ componentUrl }, 'APKINDEX file not found in tar archive');
      return null;
    }

    logger.debug('Successfully extracted APKINDEX content');

    // The cache headers are written last, so that a failure never leaves them
    // describing an index which was not stored
    await fs.renameCacheFile(extractedFile, indexFile);
    await fs.outputCacheFile(cacheFile, JSON.stringify({ etag, lastModified }));

    return indexFile;
  } finally {
    await fs.rmCache(extractDir);
  }
}

interface ArchiveResponse extends ApkIndexCache {
  statusCode: number | undefined;
}

/**
 * Download a given Index's archive to a specific path.
 *
 * Will **??**
 *
 *
 * Downloads the archive of a component, asking the registry to answer with
 * `304 Not Modified` when the cached copy is still current.
 *
 * @param http - The HTTP client to download with.
 * @param indexUrl - The URL of the archive.
 * @param archiveFile - The path to download the archive to.
 * @param cached - The cache headers of the cached copy, if there is one.
 * @returns The status code and the cache headers of the response, whose body is
 * empty when the index is unchanged.
 */
async function downloadArchive(
  http: Http,
  indexUrl: string,
  archiveFile: string,
  cached: ApkIndexCache | null,
): Promise<ArchiveResponse> {
  logger.debug(`Attempting to download ${indexUrl}`);

  const readStream = http.stream(indexUrl, {
    headers: conditionalHeaders(cached),
  });

  // A stream exposes the status code and the headers on its response event only
  const result: ArchiveResponse = { statusCode: undefined };
  readStream.on('response', (response: IncomingMessage) => {
    result.statusCode = response.statusCode;
    result.etag = response.headers.etag;
    result.lastModified = response.headers['last-modified'];
  });

  const writeStream = fs.createCacheWriteStream(archiveFile);
  await fs.pipeline(readStream, writeStream);

  return result;
}

function conditionalHeaders(cached: ApkIndexCache | null): OutgoingHttpHeaders {
  const headers: OutgoingHttpHeaders = {};

  if (cached?.etag) {
    headers['If-None-Match'] = cached.etag;
  }

  if (cached?.lastModified) {
    headers['If-Modified-Since'] = cached.lastModified;
  }

  return headers;
}

/**
 * Reads the cache headers of the cached index.
 *
 * @param cacheFile - The path of the cache headers file.
 * @param indexFile - The path of the extracted index they describe.
 * @returns The cache headers, or `null` when there is no index to revalidate.
 */
async function readIndexCache(
  cacheFile: string,
  indexFile: string,
): Promise<ApkIndexCache | null> {
  if (!(await fs.cachePathIsFile(indexFile))) {
    return null;
  }

  let content: string;
  try {
    content = await fs.readCacheFile(cacheFile, 'utf8');
  } catch (err) {
    logger.debug({ cacheFile, err }, 'Could not read the APK index cache');
    return null;
  }

  const cached = Json.pipe(ApkIndexCache).safeParse(content);
  if (!cached.success) {
    logger.debug(
      { cacheFile, err: cached.error },
      'Could not parse the APK index cache',
    );
    return null;
  }

  return cached.data;
}
