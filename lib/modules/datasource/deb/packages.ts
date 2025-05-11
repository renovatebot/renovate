import upath from 'upath';
import { logger } from '../../../logger';
import * as fs from '../../../util/fs';
import { toSha256 } from '../../../util/hash';
import type { Http } from '../../../util/http';
import { escapeRegExp, regEx } from '../../../util/regex';
import { joinUrlParts } from '../../../util/url';
import { computeFileChecksum } from './checksum';
import { cacheSubDir } from './common';
import { extract, getFileCreationTime } from './file';
import { getReleaseFileContent } from './release';
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
  let lastTimestamp = await getFileCreationTime(extractedFile);
  const releaseFile = upath.join(fullCacheDir, `${packageUrlHash}.release`);
  const baseSuiteUrl = getBaseSuiteUrl(componentUrl);
  const packagePath = getPackagePath(componentUrl);

  // fetch release file content to check which package file to download including its compression method
  let releaseContent: string | null;
  try {
    releaseContent = await getReleaseFileContent(
      baseSuiteUrl,
      releaseFile,
      http,
    );
  } catch (err) {
    releaseContent = null;
    logger.debug({ baseSuiteUrl }, err.message);
  }

  let packageReleaseInfo;
  if (releaseContent) {
    // packageReleaseInfo is set, there is a release file,
    // so we can check which package file to download and retrieve its hash value
    // NOTE: this could also be an uncompressed package file
    packageReleaseInfo = getPackageFromReleaseFile(releaseContent, packagePath);
  } else {
    // if packageReleaseInfo is null, it means the release file could not be fetched,
    // so we fall back to the original behavior of this data module
    packageReleaseInfo = {
      hash: '',
      compression: 'gz',
      packagesFile: packagePath,
    };

    logger.debug('Default to retrieving Package.gz file');
  }

  // the path to the package file to download
  const downloadedPackageFile =
    packageReleaseInfo.compression.length > 0
      ? upath.join(
          fullCacheDir,
          `${packageUrlHash}.${packageReleaseInfo.compression}`,
        )
      : extractedFile;

  // the URL to download the package file from
  const packageDownloadUrl =
    packageReleaseInfo.compression.length > 0
      ? joinUrlParts(componentUrl, `Packages.${packageReleaseInfo.compression}`)
      : joinUrlParts(componentUrl, 'Packages');

  const packageFileChanged = await downloadPackageFile(
    packageDownloadUrl,
    downloadedPackageFile,
    packageReleaseInfo?.hash ?? '',
    http,
  );

  // lastTimestamp undefined if extracted file does not exist
  if (packageFileChanged || !lastTimestamp) {
    if (packageReleaseInfo.compression.length > 0) {
      // let's extract if we have a compressed file
      try {
        await extract(
          downloadedPackageFile,
          packageReleaseInfo.compression,
          extractedFile,
        );
      } catch (error) {
        logger.warn(
          {
            downloadedPackageFile,
            componentUrl,
            compression: packageReleaseInfo.compression,
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
export function getPackageFromReleaseFile(
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
      `\\s+([a-f0-9]{64})\\s+\\d+\\s+(${escapeRegExp(packagesFile)})\r?\n`,
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

  throw new Error(`No valid package file found in release files`);
}

/**
 * Downloads a package file if its checksum does not match the expected hash.
 *
 * @param packageUrl - The base URL of the package.
 * @param packageFile - The path where the Package file will be saved.
 * @param packageHash - The expected SHA256 hash of the package file.
 * @param http - The HTTP client to use for downloading.
 * @param lastDownloadedDate - The date of the last download.
 * @returns True if the file was downloaded or changed, otherwise false.
 */
export async function downloadPackageFile(
  packageUrl: string,
  packageFile: string,
  packageHash: string,
  http: Http,
): Promise<boolean> {
  const packageFileExists = await fs.cachePathIsFile(packageFile);
  const hashProvided = packageHash.length > 0;

  if (packageFileExists && hashProvided) {
    // checke whether the file is modified locally
    const fileChecksum = await computeFileChecksum(packageFile);
    if (fileChecksum === packageHash) {
      logger.debug(
        { url: packageUrl, targetFile: packageFile },
        'Package file is already downloaded',
      );
      return false;
    }
  } else if (packageFileExists) {
    // file exists but we cannot compare as we don't have a hash value
    return false;
  }

  // download the package file
  logger.debug(
    { url: packageUrl, targetFile: packageFile },
    'Downloading Debian package file',
  );
  const readStream = http.stream(packageUrl);
  const writeStream = fs.createCacheWriteStream(packageFile);
  await fs.pipeline(readStream, writeStream);

  // if we got a hash value, we have to compare the checksums
  // the checksum should be retrieved from InRelease or Release file but
  // may not be available in every case
  if (packageHash?.length > 0) {
    const actualChecksum = await computeFileChecksum(packageFile);

    if (actualChecksum !== packageHash) {
      await fs.rmCache(packageFile);
      throw new Error('SHA256 checksum validation failed');
    }
  }

  return true;
}
