import { nanoid } from 'nanoid';
import upath from 'upath';
import { logger } from '../../../logger';
import * as fs from '../../../util/fs';
import { toSha256 } from '../../../util/hash';
import type { Http, HttpOptions } from '../../../util/http';
import { escapeRegExp, regEx } from '../../../util/regex';
import { joinUrlParts } from '../../../util/url';
import { computeFileChecksum } from './checksum';
import { cacheSubDir } from './common';
import { extract, getFileCreationTime } from './file';
import { fetchReleaseFile } from './release';
import { PackagesCompressionAlgos } from './types';
import { getBaseSuiteUrl, getPackagePath } from './url';

/**
 * Downloads and extracts a package file from a component URL.
 *
 * @param componentUrl - The URL of the component.
 * @param http - The HTTP client to use for downloading.
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
  const baseSuiteUrl = getBaseSuiteUrl(componentUrl);
  const packagePath = getPackagePath(componentUrl);
  let lastTimestamp = await getFileCreationTime(extractedFile);

  // fetch release file to check which package file to download including its compression method
  let releaseContent: string | null;
  try {
    releaseContent = await fetchReleaseFile(baseSuiteUrl, http);
  } catch (error) {
    releaseContent = null;
    logger.debug(
      { baseSuiteUrl, error: error.message },
      'Failed to fetch release file',
    );
  }

  let packageReleaseInfo;
  // parse the release file to get the package file URL and its compression method
  if (releaseContent) {
    try {
      packageReleaseInfo = getPackagesRelativeUrlFromReleaseFile(
        releaseContent,
        packagePath,
      );
    } catch (error) {
      packageReleaseInfo = null;
      logger.debug(
        { baseSuiteUrl, packagePath, error: error.message },
        'Failed to find package file in release file',
      );
    }
  }

  // if packageReleaseInfo is not null, it means a Package file was found in the release file, thus we know the compression method
  // we fall back to the original behavior of fetching the Package.gz file directly if Release file is not available
  // compression can also be empty if there is only a package file without compression available
  const compression = packageReleaseInfo
    ? packageReleaseInfo.compression
    : 'gz';

  // the path to the package file to download
  const downloadedPackageFile =
    compression.length > 0
      ? upath.join(fullCacheDir, `${nanoid()}_${packageUrlHash}.${compression}`)
      : extractedFile;

  // the URL to download the package file from
  const packageDownloadUrl =
    compression.length > 0
      ? joinUrlParts(componentUrl, `Packages.${compression}`)
      : joinUrlParts(componentUrl, 'Packages');

  const packageFileChanged = await downloadPackageFile(
    packageDownloadUrl,
    downloadedPackageFile,
    packageReleaseInfo?.hash ?? '',
    http,
    lastTimestamp,
  );

  if (packageFileChanged || !lastTimestamp) {
    if (compression.length > 0) {
      // let's extract if we have a compressed file
      try {
        await extract(downloadedPackageFile, compression, extractedFile);
      } catch (error) {
        logger.warn(
          {
            downloadedPackageFile,
            componentUrl,
            compression,
            error: error.message,
          },
          'Failed to extract package file from compressed file',
        );
      } finally {
        await fs.rmCache(downloadedPackageFile);
      }
    }

    lastTimestamp = await getFileCreationTime(extractedFile);

    if (!lastTimestamp) {
      // extracting or downloading uncompressed Packages file went wrong
      throw new Error('Missing metadata in extracted package index file!');
    }
  }

  return { extractedFile, lastTimestamp };
}

/**
 * Retrieves the packages file (e.g. Packages.gz) from the release file.
 * It returns the packages file in the following order (Packages.xz, Packages.bz2, Packages.gz) if available.
 *
 * @param releaseFileContent
 * @param basePackageUrl - The base URL of the package.
 * @throws Will throw an error if no packages file is found for the basePackageUrl in the release file.
 * @returns The hash and the packages file URL (without baseUrl).
 */
export function getPackagesRelativeUrlFromReleaseFile(
  releaseFileContent: string,
  basePackageUrl: string,
): {
  hash: string;
  compression: string;
  packagesFile: string;
} {
  const compressionMethods = [...PackagesCompressionAlgos, ''];

  for (const compressionMethod of compressionMethods) {
    let packagesFile = '';
    if (compressionMethod.length > 0) {
      packagesFile = joinUrlParts(
        basePackageUrl,
        `Packages.${compressionMethod}`,
      );
    } else {
      packagesFile = joinUrlParts(basePackageUrl, 'Packages');
    }
    // 64 --> SHA256
    const regex = regEx(
      `([a-f0-9]{64})\\s+\\d+\\s+(${escapeRegExp(packagesFile)})\r?\n`,
    );

    const match = regex.exec(releaseFileContent);
    if (match) {
      return {
        hash: match[1],
        compression: compressionMethod,
        packagesFile,
      };
    }
  }

  throw new Error('No packages file found in the release file');
}

/**
 * Downloads a package file if it has been modified since the last download timestamp.
 *
 * @param packageUrl - The base URL of the package.
 * @param packageFile - The path where the Package file will be saved.
 * @param packageHash - The expected SHA256 hash of the package file.
 * @param http - The HTTP client to use for downloading.
 * @param lastDownloadTimestamp - The timestamp of the last download.
 * @returns True if the file was downloaded or changed, otherwise false.
 */
export async function downloadPackageFile(
  packageUrl: string,
  packageFile: string,
  packageHash: string,
  http: Http,
  lastDownloadTimestamp?: Date,
): Promise<boolean> {
  let packageChanged = true;

  if (lastDownloadTimestamp) {
    try {
      packageChanged = await checkIfModified(
        packageUrl,
        lastDownloadTimestamp,
        http,
      );
    } catch (error) {
      logger.warn(
        { packageUrl, lastDownloadTimestamp, errorMessage: error.message },
        'Could not determine if package file is modified since last download',
      );
      return true; // Assume it needs to be downloaded if check fails
    }
  }

  if (!packageChanged) {
    logger.debug(`No need to download ${packageUrl}, file is up to date.`);
    return false;
  }
  const readStream = http.stream(packageUrl);
  const writeStream = fs.createCacheWriteStream(packageFile);
  await fs.pipeline(readStream, writeStream);
  logger.debug(
    { url: packageUrl, targetFile: packageFile },
    'Downloading Debian package file',
  );

  if (packageHash?.length > 0) {
    const actualChecksum = await computeFileChecksum(packageFile);

    if (actualChecksum !== packageHash) {
      await fs.rmCache(packageFile);
      throw new Error('SHA256 checksum validation failed');
    }
  }

  return packageChanged;
}

/**
 * Checks if a packageUrl content has been modified since the specified timestamp.
 *
 * @param packageUrl - The URL to check.
 * @param lastDownloadTimestamp - The timestamp of the last download.
 * @returns True if the content has been modified, otherwise false.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Modified-Since
 * @throws Error if the request fails.
 */
export async function checkIfModified(
  packageUrl: string,
  lastDownloadTimestamp: Date,
  http: Http,
): Promise<boolean> {
  const options: HttpOptions = {
    headers: {
      'If-Modified-Since': lastDownloadTimestamp.toUTCString(),
    },
  };

  const response = await http.head(packageUrl, options);
  return response.statusCode !== 304;
}
