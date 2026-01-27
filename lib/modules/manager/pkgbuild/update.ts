import crypto from 'node:crypto';
import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import * as fs from '../../../util/fs/index.ts';
import { ensureCacheDir } from '../../../util/fs/index.ts';
import { Http } from '../../../util/http/index.ts';
import { regEx } from '../../../util/regex.ts';
import type { UpdateDependencyConfig } from '../types.ts';
import type { ChecksumData, ChecksumEntry, MultiSourceData } from './types.ts';

const http = new Http('pkgbuild');

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

  // Escape special regex characters in version string
  const escapedOldVer = oldVer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Handle both quoted and unquoted pkgver values: pkgver=1.0.0 or pkgver="1.0.0"
  return content.replace(
    regEx(`^(pkgver=["']?)${escapedOldVer}(["']?)$`, 'm'),
    `$1${newVer}$2`,
  );
}

/**
 * Reset pkgrel to 1
 * According to Arch Linux packaging guidelines, pkgrel should be reset to 1 when pkgver changes
 */
function resetPkgrel(content: string): string {
  // Handle both quoted and unquoted pkgrel values: pkgrel=1 or pkgrel="1"
  return content.replace(
    regEx('^(pkgrel=["\']?)\\d+(["\']?)$', 'm'),
    '$1' + '1' + '$2',
  );
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
 * Handles both single checksums and architecture-specific checksum arrays
 */
function updateChecksum(
  content: string,
  checksumType: string,
  oldChecksum: string,
  newChecksum: string,
  suffix?: string,
): string {
  const suffixPattern = suffix ?? '(?:_[^=]+)?';
  return content.replace(
    regEx(`(${checksumType}sums${suffixPattern}=\\(['"]?)${oldChecksum}`, 'm'),
    `$1${newChecksum}`,
  );
}

/**
 * Update checksums - handles both single and multiple architecture-specific checksums
 */
function updateChecksums(
  content: string,
  checksumType: 'sha256' | 'sha512' | 'b2' | 'md5',
  oldChecksums: string | ChecksumEntry[],
  newChecksum: string,
): string {
  let updatedContent = content;

  // Handle array of architecture-specific checksums
  if (Array.isArray(oldChecksums)) {
    for (const entry of oldChecksums) {
      updatedContent = updateChecksum(
        updatedContent,
        checksumType,
        entry.value,
        newChecksum,
        entry.suffix,
      );
    }
  } else {
    // Handle single checksum (backward compatibility)
    updatedContent = updateChecksum(
      updatedContent,
      checksumType,
      oldChecksums,
      newChecksum,
    );
  }

  return updatedContent;
}

/**
 * Expand variables in URL
 */
function expandUrl(url: string, pkgver: string): string {
  return url
    .replace(/\$\{pkgver\}/g, pkgver.replace(/^v/, ''))
    .replace(/\$pkgver/g, pkgver.replace(/^v/, ''))
    .replace(/\$\{_pkgver\}/g, pkgver.replace(/^v/, ''))
    .replace(/\$_pkgver/g, pkgver.replace(/^v/, ''));
}

/**
 * Update checksum array in PKGBUILD content
 * Replaces the checksum at the specified index while preserving others
 */
function updateChecksumAtIndex(
  content: string,
  checksumType: 'sha256' | 'sha512' | 'b2' | 'md5',
  index: number,
  newChecksum: string,
): string {
  logger.debug(
    { checksumType, index, newChecksum },
    'updateChecksumAtIndex called',
  );

  // Match the entire checksums block
  const regex = regEx(
    `(${checksumType}sums(?:_[^=]+)?=\\()([\\s\\S]*?)(\\))`,
    'm',
  );
  const match = regex.exec(content);

  if (!match) {
    logger.debug({ checksumType }, 'No checksum block found');
    return content;
  }

  const prefix = match[1];
  const checksumBlock = match[2];
  const suffix = match[3];

  logger.debug({ checksumBlock }, 'Checksum block found');

  // Extract all checksums preserving quotes and whitespace structure
  // Note: RE2 doesn't support backreferences, so we try both quote types separately
  const entries: { value: string; prefix: string; suffix: string }[] = [];
  let entryMatch: RegExpExecArray | null;

  // Try single quotes first (most common in PKGBUILDs)
  const singleQuoteRegex = regEx(/(\s*)'([^']+)'(\s*)/g);
  while ((entryMatch = singleQuoteRegex.exec(checksumBlock)) !== null) {
    entries.push({
      prefix: entryMatch[1],
      value: entryMatch[2],
      suffix: entryMatch[3],
    });
  }

  // If no single quotes found, try double quotes
  if (entries.length === 0) {
    logger.debug('No single quotes found, trying double quotes');
    const doubleQuoteRegex = regEx(/(\s*)"([^"]+)"(\s*)/g);
    while ((entryMatch = doubleQuoteRegex.exec(checksumBlock)) !== null) {
      entries.push({
        prefix: entryMatch[1],
        value: entryMatch[2],
        suffix: entryMatch[3],
      });
    }
  }

  // If we couldn't parse entries with quotes, try without quotes
  if (entries.length === 0) {
    logger.debug('No quoted entries found, trying without quotes');
    const simpleEntryRegex = regEx(/(\s*)([^\s'"()]+)(\s*)/g);
    while ((entryMatch = simpleEntryRegex.exec(checksumBlock)) !== null) {
      entries.push({
        prefix: entryMatch[1],
        value: entryMatch[2],
        suffix: entryMatch[3],
      });
    }
  }

  logger.debug({ entriesCount: entries.length }, 'Extracted entries');

  if (index >= entries.length) {
    logger.debug(
      { index, entriesLength: entries.length },
      'Index out of bounds for checksum update',
    );
    return content;
  }

  // Update the checksum at the specified index
  const oldValue = entries[index].value;
  entries[index].value = newChecksum;

  logger.debug(
    { index, oldValue, newValue: newChecksum },
    'Updating checksum at index',
  );

  // Reconstruct the block
  const newBlock = entries
    .map((e) => `${e.prefix}'${e.value}'${e.suffix}`)
    .join('');

  const result = content.replace(regex, `${prefix}${newBlock}${suffix}`);
  logger.debug({ updated: result !== content }, 'Checksum update complete');
  return result;
}

/**
 * Update multiple checksums for multi-source PKGBUILDs
 */
async function updateMultiSourceChecksums(
  content: string,
  multiSource: MultiSourceData,
  newValue: string,
): Promise<string> {
  let updatedContent = content;
  const { sources, checksums } = multiSource;

  // Process each source that uses pkgver
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];

    if (!source.usesPkgver) {
      continue;
    }

    // Skip if checksums at this index are SKIP
    const sha256AtIndex = checksums.sha256?.[i];
    if (sha256AtIndex === 'SKIP') {
      logger.debug({ index: i }, 'Skipping SKIP checksum');
      continue;
    }

    try {
      const downloadUrl = expandUrl(source.url, newValue);
      logger.debug(
        { index: i, url: downloadUrl },
        'Computing checksums for source',
      );

      const newChecksums = await computeChecksums(downloadUrl);

      // Update each checksum type at this index
      if (checksums.sha256?.[i] && newChecksums.sha256) {
        updatedContent = updateChecksumAtIndex(
          updatedContent,
          'sha256',
          i,
          newChecksums.sha256 as string,
        );
      }
      if (checksums.sha512?.[i] && newChecksums.sha512) {
        updatedContent = updateChecksumAtIndex(
          updatedContent,
          'sha512',
          i,
          newChecksums.sha512 as string,
        );
      }
      if (checksums.b2?.[i] && newChecksums.b2) {
        updatedContent = updateChecksumAtIndex(
          updatedContent,
          'b2',
          i,
          newChecksums.b2 as string,
        );
      }
      if (checksums.md5?.[i] && newChecksums.md5) {
        updatedContent = updateChecksumAtIndex(
          updatedContent,
          'md5',
          i,
          newChecksums.md5 as string,
        );
      }
    } catch (err) {
      logger.warn(
        { err, index: i, url: source.url },
        'Failed to compute checksums for source',
      );
      // Continue with other sources
    }
  }

  return updatedContent;
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
 * Downloads the file once to cache, then computes all hashes from the cached file
 */
async function computeChecksums(url: string): Promise<ChecksumData> {
  const checksums: ChecksumData = {};

  try {
    // Get cache directory for temporary file storage
    const cacheDir = await ensureCacheDir('pkgbuild');
    const fileName = url.split('/').pop() ?? 'download';
    const downloadPath = upath.join(cacheDir, `temp-${Date.now()}-${fileName}`);

    logger.debug(
      { url, downloadPath },
      'Downloading file for checksum computation',
    );

    // Download file once to cache
    const readStream = http.stream(url);
    const writeStream = fs.createCacheWriteStream(downloadPath);

    try {
      await fs.pipeline(readStream, writeStream);

      // Compute all hashes from the cached file
      const fileBuffer = await fs.readCacheFile(downloadPath);

      // SHA256
      const sha256Hash = crypto.createHash('sha256');
      sha256Hash.update(fileBuffer);
      checksums.sha256 = sha256Hash.digest('hex');

      // SHA512
      const sha512Hash = crypto.createHash('sha512');
      sha512Hash.update(fileBuffer);
      checksums.sha512 = sha512Hash.digest('hex');

      // BLAKE2b512
      const b2Hash = crypto.createHash('blake2b512');
      b2Hash.update(fileBuffer);
      checksums.b2 = b2Hash.digest('hex');

      // MD5
      const md5Hash = crypto.createHash('md5');
      md5Hash.update(fileBuffer);
      checksums.md5 = md5Hash.digest('hex');

      logger.debug({ checksums }, 'Computed checksums for new version');
    } finally {
      // Clean up temporary file
      await fs.rmCache(downloadPath);
    }
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

  const { sourceUrl, checksums, pkgver, multiSource } = managerData;

  if (!sourceUrl) {
    logger.debug('No source URL in managerData');
    return null;
  }

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

  // Reset pkgrel to 1 when pkgver changes (Arch Linux packaging convention)
  updatedContent = resetPkgrel(updatedContent);

  // Update source URL (for single-source compatibility)
  updatedContent = updateSource(updatedContent, sourceUrl, newUrl);

  // Handle multi-source PKGBUILDs
  if (
    multiSource &&
    multiSource.sources.length > 1 &&
    Object.keys(multiSource.checksums).length > 0
  ) {
    logger.debug(
      { sourceCount: multiSource.sources.length },
      'Processing multi-source PKGBUILD',
    );
    updatedContent = await updateMultiSourceChecksums(
      updatedContent,
      multiSource,
      newValue,
    );
  }
  // Handle single-source PKGBUILDs (backward compatibility)
  else if (checksums && Object.keys(checksums).length > 0) {
    try {
      // Expand URL with new version for downloading
      const downloadUrl = expandUrl(newUrl, newValue);
      const newChecksums = await computeChecksums(downloadUrl);

      // Update sha256sums (computeChecksums always returns string checksums)
      if (checksums.sha256 && newChecksums.sha256) {
        updatedContent = updateChecksums(
          updatedContent,
          'sha256',
          checksums.sha256,
          newChecksums.sha256 as string,
        );
      }

      // Update sha512sums
      if (checksums.sha512 && newChecksums.sha512) {
        updatedContent = updateChecksums(
          updatedContent,
          'sha512',
          checksums.sha512,
          newChecksums.sha512 as string,
        );
      }

      // Update b2sums (BLAKE2)
      if (checksums.b2 && newChecksums.b2) {
        updatedContent = updateChecksums(
          updatedContent,
          'b2',
          checksums.b2,
          newChecksums.b2 as string,
        );
      }

      // Update md5sums
      if (checksums.md5 && newChecksums.md5) {
        updatedContent = updateChecksums(
          updatedContent,
          'md5',
          checksums.md5,
          newChecksums.md5 as string,
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
}
