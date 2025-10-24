import { nanoid } from 'nanoid';
import upath from 'upath';
import { logger } from '../../../logger';
import * as fs from '../../../util/fs';
import { toSha256 } from '../../../util/hash';
import type { Http } from '../../../util/http';
import { joinUrlParts } from '../../../util/url';
import { computeFileChecksum, parseChecksumsFromInRelease } from './checksum';
import { cacheSubDir } from './common';
import { checkIfModified, getBaseSuiteUrl } from './url';
import { extract, getFileCreationTime } from './utils';

/**
 * Downloads and extracts a package file from a component URL.
 *
 * @param componentUrl - The URL of the component.
 * @returns The path to the extracted file and the last modification timestamp.
 * @throws Will throw an error if no valid compression method is found.
 */
export async function downloadAndExtractPackage(
  componentUrl: string,
  http: Http,
): Promise<{ extractedFile: string; lastTimestamp: Date }> {
  const packageUrlHash = toSha256(componentUrl);
  const fullCacheDir = await fs.ensureCacheDir(cacheSubDir);
  const extractedFile = upath.join(fullCacheDir, `${packageUrlHash}.txt`);
  let lastTimestamp = await getFileCreationTime(extractedFile);

  const compression = 'gz';
  const compressedFile = upath.join(
    fullCacheDir,
    `${nanoid()}_${packageUrlHash}.${compression}`,
  );

  const wasUpdated = await downloadPackageFile(
    componentUrl,
    compression,
    compressedFile,
    http,
    lastTimestamp,
  );

  if (wasUpdated || !lastTimestamp) {
    try {
      await extract(compressedFile, compression, extractedFile);
      lastTimestamp = await getFileCreationTime(extractedFile);
    } catch (error) {
      logger.warn(
        {
          compressedFile,
          componentUrl,
          compression,
          error: error.message,
        },
        'Failed to extract package file from compressed file',
      );
    } finally {
      await fs.rmCache(compressedFile);
    }
  }

  if (!lastTimestamp) {
    //extracting went wrong
    throw new Error('Missing metadata in extracted package index file!');
  }

  return { extractedFile, lastTimestamp };
}

/**
 * Downloads a package file if it has been modified since the last download timestamp.
 *
 * @param basePackageUrl - The base URL of the package.
 * @param compression - The compression method used (e.g., 'gz').
 * @param compressedFile - The path where the compressed file will be saved.
 * @param lastDownloadTimestamp - The timestamp of the last download.
 * @returns True if the file was downloaded, otherwise false.
 */
export async function downloadPackageFile(
  basePackageUrl: string,
  compression: string,
  compressedFile: string,
  http: Http,
  lastDownloadTimestamp?: Date,
): Promise<boolean> {
  const baseSuiteUrl = getBaseSuiteUrl(basePackageUrl);
  const packageUrl = joinUrlParts(basePackageUrl, `Packages.${compression}`);
  let needsToDownload = true;

  if (lastDownloadTimestamp) {
    needsToDownload = await checkIfModified(
      packageUrl,
      lastDownloadTimestamp,
      http,
    );
  }

  if (!needsToDownload) {
    logger.debug(`No need to download ${packageUrl}, file is up to date.`);
    return false;
  }
  const readStream = http.stream(packageUrl);
  const writeStream = fs.createCacheWriteStream(compressedFile);
  await fs.pipeline(readStream, writeStream);
  logger.debug(
    { url: packageUrl, targetFile: compressedFile },
    'Downloading Debian package file',
  );

  let inReleaseContent = '';

  try {
    inReleaseContent = await fetchInReleaseFile(baseSuiteUrl, http);
  } catch (error) {
    // This is expected to fail for Artifactory if GPG verification is not enabled
    logger.debug(
      { url: baseSuiteUrl, err: error },
      'Could not fetch InRelease file',
    );
  }

  if (inReleaseContent) {
    const actualChecksum = await computeFileChecksum(compressedFile);
    const expectedChecksum = parseChecksumsFromInRelease(
      inReleaseContent,
      // path to the Package.gz file
      packageUrl.replace(`${baseSuiteUrl}/`, ''),
    );
    if (actualChecksum !== expectedChecksum) {
      await fs.rmCache(compressedFile);
      throw new Error('SHA256 checksum validation failed');
    }
  }

  return needsToDownload;
}

/**
 * Fetches the content of the InRelease file from the given base suite URL.
 *
 * @param baseReleaseUrl - The base URL of the suite (e.g., 'https://deb.debian.org/debian/dists/bullseye').
 * @returns resolves to the content of the InRelease file.
 * @throws An error if the InRelease file could not be downloaded.
 */
export async function fetchInReleaseFile(
  baseReleaseUrl: string,
  http: Http,
): Promise<string> {
  const inReleaseUrl = joinUrlParts(baseReleaseUrl, 'InRelease');
  const response = await http.getText(inReleaseUrl);
  return response.body;
}
