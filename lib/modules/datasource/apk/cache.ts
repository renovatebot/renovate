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
import { ApkIndexValidators } from './schema.ts';

const cacheSubDir = 'apk';
const archiveFileName = 'APKINDEX.tar.gz';
const indexFileName = 'APKINDEX';
const validatorsFileName = 'APKINDEX.validators.json';

/**
 * Downloads and extracts `APKINDEX.tar.gz` for a component, unless the copy in
 * the cache directory is still current.
 *
 * An index holds thousands of packages and is several megabytes in size, so the
 * `ETag` and `Last-Modified` of the archive are cached next to the extracted
 * index. A later run only downloads the archive again once the registry answers
 * the conditional request with something other than `304 Not Modified`.
 *
 * The validators are cached on disk rather than in the package cache, because
 * they describe the copy which this cache directory holds. A package cache can
 * be shared between machines, which would let one machine revalidate an index
 * that another machine downloaded.
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
  const validatorsFile = upath.join(componentDir, validatorsFileName);

  const cachedValidators = await readValidators(validatorsFile, indexFile);

  const indexUrl = joinUrlParts(componentUrl, archiveFileName);
  const extractDir = await fs.ensureCacheDir(
    upath.join(componentCacheDir, randomUUID()),
  );

  try {
    const archiveFile = upath.join(extractDir, archiveFileName);
    const { statusCode, validators } = await downloadArchive(
      http,
      indexUrl,
      archiveFile,
      cachedValidators,
    );

    if (cachedValidators && statusCode === 304) {
      logger.debug(`APK index ${indexUrl} is unchanged, using the cached copy`);
      return indexFile;
    }

    await tarExtract({
      file: archiveFile,
      cwd: extractDir,
      filter: (path) => upath.basename(path) === indexFileName,
    });

    const extractedFile = upath.join(extractDir, indexFileName);
    if (!(await fs.cachePathExists(extractedFile))) {
      logger.warn({ componentUrl }, 'APKINDEX file not found in tar archive');
      return null;
    }

    logger.debug('Successfully extracted APKINDEX content');

    // The validators are written last, so that a failure never leaves them
    // describing an index which was not stored
    await fs.renameCacheFile(extractedFile, indexFile);
    await fs.outputCacheFile(validatorsFile, JSON.stringify(validators));

    return indexFile;
  } finally {
    await fs.rmCache(extractDir);
  }
}

interface ArchiveResponse {
  statusCode: number | undefined;
  validators: ApkIndexValidators;
}

/**
 * Downloads the archive of a component, asking the registry to answer with
 * `304 Not Modified` when the cached copy is still current.
 *
 * @param http - The HTTP client to download with.
 * @param indexUrl - The URL of the archive.
 * @param archiveFile - The path to download the archive to.
 * @param cachedValidators - The validators of the cached copy, if there is one.
 * @returns The status code and the validators of the response, whose body is
 * empty when the index is unchanged.
 */
async function downloadArchive(
  http: Http,
  indexUrl: string,
  archiveFile: string,
  cachedValidators: ApkIndexValidators | null,
): Promise<ArchiveResponse> {
  logger.debug(`Attempting to download ${indexUrl}`);

  const readStream = http.stream(indexUrl, {
    headers: conditionalHeaders(cachedValidators),
  });

  // A stream exposes the status code and the headers on its response event only
  const result: ArchiveResponse = { statusCode: undefined, validators: {} };
  readStream.on('response', (response: IncomingMessage) => {
    result.statusCode = response.statusCode;
    result.validators = {
      etag: response.headers.etag,
      lastModified: response.headers['last-modified'],
    };
  });

  const writeStream = fs.createCacheWriteStream(archiveFile);
  await fs.pipeline(readStream, writeStream);

  return result;
}

function conditionalHeaders(
  cachedValidators: ApkIndexValidators | null,
): OutgoingHttpHeaders {
  const headers: OutgoingHttpHeaders = {};

  if (cachedValidators?.etag) {
    headers['If-None-Match'] = cachedValidators.etag;
  }

  if (cachedValidators?.lastModified) {
    headers['If-Modified-Since'] = cachedValidators.lastModified;
  }

  return headers;
}

/**
 * Reads the validators of the cached index.
 *
 * @param validatorsFile - The path of the validators file.
 * @param indexFile - The path of the extracted index they describe.
 * @returns The validators, or `null` when there is no index to revalidate.
 */
async function readValidators(
  validatorsFile: string,
  indexFile: string,
): Promise<ApkIndexValidators | null> {
  if (!(await fs.cachePathExists(indexFile))) {
    return null;
  }

  let content: string;
  try {
    content = await fs.readCacheFile(validatorsFile, 'utf8');
  } catch (err) {
    logger.debug(
      { validatorsFile, err },
      'Could not read the cached APK index validators',
    );
    return null;
  }

  const validators = Json.pipe(ApkIndexValidators).safeParse(content);
  if (!validators.success) {
    logger.debug(
      { validatorsFile, err: validators.error },
      'Could not parse the cached APK index validators',
    );
    return null;
  }

  return validators.data;
}
