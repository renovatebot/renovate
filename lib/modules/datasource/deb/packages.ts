import { logger } from '../../../logger/index.ts';
import type { Http } from '../../../util/http/index.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { getCachedGunzippedFile } from '../cached-index.ts';
import type { CachedIndexFile } from '../types.ts';
import {
  computeFileChecksum,
  parseChecksumsFromInRelease,
} from './checksum.ts';
import { cacheSubDir } from './common.ts';
import { getBaseSuiteUrl } from './url.ts';

/**
 * Downloads and extracts a package file from a component URL.
 *
 * @param componentUrl - The URL of the component.
 * @returns The path to the extracted file and the last modification timestamp.
 */
export function downloadAndExtractPackage(
  componentUrl: string,
  http: Http,
): Promise<CachedIndexFile> {
  const baseSuiteUrl = getBaseSuiteUrl(componentUrl);
  const packageUrl = joinUrlParts(componentUrl, 'Packages.gz');

  return getCachedGunzippedFile(http, packageUrl, {
    cacheSubDir,
    extension: 'txt',
    description: 'package index file',
    beforeExtract: (compressedFile) =>
      verifyPackageChecksum(baseSuiteUrl, packageUrl, compressedFile, http),
  });
}

/**
 * Verifies the downloaded package index against the checksum published in the
 * InRelease file of the suite.
 *
 * Repositories which do not serve an InRelease file are accepted as is.
 *
 * @throws Will throw an error if the checksums do not match.
 */
async function verifyPackageChecksum(
  baseSuiteUrl: string,
  packageUrl: string,
  compressedFile: string,
  http: Http,
): Promise<void> {
  let inReleaseContent = '';

  try {
    inReleaseContent = await fetchInReleaseFile(baseSuiteUrl, http);
  } catch (err) {
    // This is expected to fail for Artifactory if GPG verification is not enabled
    logger.debug({ url: baseSuiteUrl, err }, 'Could not fetch InRelease file');
  }

  if (!inReleaseContent) {
    return;
  }

  const actualChecksum = await computeFileChecksum(compressedFile);
  const expectedChecksum = parseChecksumsFromInRelease(
    inReleaseContent,
    // path to the Package.gz file
    packageUrl.replace(`${baseSuiteUrl}/`, ''),
  );
  if (actualChecksum !== expectedChecksum) {
    throw new Error('SHA256 checksum validation failed');
  }
}

/**
 * Fetches the content of the InRelease file from the given base suite URL.
 *
 * @param baseReleaseUrl - The base URL of the suite (e.g., 'https://deb.debian.org/debian/dists/bullseye').
 * @returns resolves to the content of the InRelease file.
 * @throws An error if the InRelease file could not be downloaded.
 */
async function fetchInReleaseFile(
  baseReleaseUrl: string,
  http: Http,
): Promise<string> {
  const inReleaseUrl = joinUrlParts(baseReleaseUrl, 'InRelease');
  const response = await http.getText(inReleaseUrl);
  return response.body;
}
