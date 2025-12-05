import { logger } from '../../../logger';
import { hashStream } from '../../../util/hash';
import { Http } from '../../../util/http';
import { regEx } from '../../../util/regex';
import type { UpdateDependencyConfig } from '../types';

const http = new Http('pkgbuild');

interface ChecksumData {
  sha256?: string;
  sha512?: string;
  b2?: string;
  md5?: string;
}

/**
 * Update pkgver in PKGBUILD
 */
function updatePkgver(
  content: string,
  oldVersion: string,
  newVersion: string,
): string {
  // Remove leading 'v' from versions for comparison
  const oldVer = oldVersion.replace(/^v/, '');
  const newVer = newVersion.replace(/^v/, '');

  return content.replace(regEx(`^(pkgver=)${oldVer}$`, 'm'), `$1${newVer}`);
}

/**
 * Update source URL in PKGBUILD
 */
function updateSource(content: string, oldUrl: string, newUrl: string): string {
  // Escape special regex characters in URLs
  const escapedOldUrl = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return content.replace(
    regEx(`(source(?:_[^=]+)?=\\(['"]?)${escapedOldUrl}`, 'm'),
    `$1${newUrl}`,
  );
}

/**
 * Update checksum in PKGBUILD
 */
function updateChecksum(
  content: string,
  checksumType: string,
  oldChecksum: string,
  newChecksum: string,
): string {
  return content.replace(
    regEx(`(${checksumType}sums(?:_[^=]+)?=\\(['"]?)${oldChecksum}`, 'm'),
    `$1${newChecksum}`,
  );
}

/**
 * Expand variables in URL
 */
function expandUrl(url: string, pkgver: string): string {
  return url
    .replace(/\$\{pkgver\}/g, pkgver.replace(/^v/, ''))
    .replace(/\$pkgver/g, pkgver.replace(/^v/, ''));
}

/**
 * Compute new URL for the updated version
 */
function computeNewUrl(
  oldUrl: string,
  oldVersion: string,
  newVersion: string,
): string {
  // If the URL contains variables, it doesn't need updating
  // (the pkgver update will take care of it)
  if (oldUrl.includes('$' + '{pkgver}') || oldUrl.includes('$pkgver')) {
    return oldUrl;
  }

  // Replace literal version in URL
  return oldUrl.replace(oldVersion, newVersion);
}

/**
 * Download file and compute checksums
 */
async function computeChecksums(url: string): Promise<ChecksumData> {
  const checksums: ChecksumData = {};

  try {
    // We need to download multiple times for different hash algorithms
    // since stream can only be consumed once
    const sha256Promise = hashStream(http.stream(url), 'sha256');
    const sha512Promise = hashStream(http.stream(url), 'sha512');
    const b2Promise = hashStream(http.stream(url), 'blake2b512');
    const md5Promise = hashStream(http.stream(url), 'md5');

    const [sha256, sha512, b2, md5] = await Promise.all([
      sha256Promise,
      sha512Promise,
      b2Promise,
      md5Promise,
    ]);

    checksums.sha256 = sha256;
    checksums.sha512 = sha512;
    checksums.b2 = b2;
    checksums.md5 = md5;

    logger.debug({ checksums }, 'Computed checksums for new version');
  } catch (err) {
    logger.warn(
      { err, url },
      'Failed to download file for checksum computation',
    );
    throw err;
  }

  return checksums;
}

export async function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): Promise<string | null> {
  logger.trace('pkgbuild.updateDependency()');

  const { currentValue, newValue, managerData } = upgrade;

  if (!currentValue || !newValue || !managerData) {
    logger.debug('Missing required data for update');
    return null;
  }

  const { sourceUrl, checksums, pkgver } = managerData;

  if (!sourceUrl) {
    logger.debug('No source URL in managerData');
    return null;
  }

  try {
    // Compute new URL
    const newUrl = computeNewUrl(sourceUrl, currentValue, newValue);
    logger.debug({ oldUrl: sourceUrl, newUrl }, 'Computed new URL');

    let updatedContent = fileContent;

    // Update pkgver
    updatedContent = updatePkgver(
      updatedContent,
      pkgver ?? currentValue,
      newValue,
    );

    // Update source URL
    updatedContent = updateSource(updatedContent, sourceUrl, newUrl);

    // Compute and update checksums if they exist
    if (checksums && Object.keys(checksums).length > 0) {
      try {
        // Expand URL with new version for downloading
        const downloadUrl = expandUrl(newUrl, newValue);
        const newChecksums = await computeChecksums(downloadUrl);

        // Update sha256sums
        if (checksums.sha256 && newChecksums.sha256) {
          updatedContent = updateChecksum(
            updatedContent,
            'sha256',
            checksums.sha256,
            newChecksums.sha256,
          );
        }

        // Update sha512sums
        if (checksums.sha512 && newChecksums.sha512) {
          updatedContent = updateChecksum(
            updatedContent,
            'sha512',
            checksums.sha512,
            newChecksums.sha512,
          );
        }

        // Update b2sums (BLAKE2)
        if (checksums.b2 && newChecksums.b2) {
          updatedContent = updateChecksum(
            updatedContent,
            'b2',
            checksums.b2,
            newChecksums.b2,
          );
        }

        // Update md5sums
        if (checksums.md5 && newChecksums.md5) {
          updatedContent = updateChecksum(
            updatedContent,
            'md5',
            checksums.md5,
            newChecksums.md5,
          );
        }

        logger.debug('Successfully updated checksums');
      } catch (err) {
        logger.warn(
          { err },
          'Failed to compute new checksums - continuing without checksum update',
        );
        // Continue without checksum update - user can run updpkgsums manually
      }
    }

    return updatedContent;
  } catch (err) {
    logger.debug({ err }, 'Failed to update PKGBUILD');
    return null;
  }
}
