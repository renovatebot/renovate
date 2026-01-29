import { logger } from '../../../logger/index.ts';
import { hashStream } from '../../../util/hash.ts';
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

  return content.replace(regEx(`^(pkgver=)${oldVer}$`, 'm'), `$1${newVer}`);
}

/**
 * Reset pkgrel to 1
 * According to Arch Linux packaging guidelines, pkgrel should be reset to 1 when pkgver changes
 */
function resetPkgrel(content: string): string {
  return content.replace(regEx('^(pkgrel=)\\d+$', 'm'), '$1' + '1');
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
  // Match the entire checksums block
  const regex = new RegExp(
    `(${checksumType}sums(?:_[^=]+)?=\\()([\\s\\S]*?)(\\))`,
    'm',
  );
  const match = regex.exec(content);

  if (!match) {
    return content;
  }

  const prefix = match[1];
  const checksumBlock = match[2];
  const suffix = match[3];

  // Extract all checksums preserving quotes and whitespace structure
  const entries: { value: string; prefix: string; suffix: string }[] = [];
  const entryRegex = /(\s*)(['"])([^'"]+)\2(\s*)/g;
  let entryMatch: RegExpExecArray | null;

  while ((entryMatch = entryRegex.exec(checksumBlock)) !== null) {
    entries.push({
      prefix: entryMatch[1],
      value: entryMatch[3],
      suffix: entryMatch[4],
    });
  }

  // If we couldn't parse entries with quotes, try without quotes
  if (entries.length === 0) {
    const simpleEntryRegex = /(\s*)([^\s'"()]+)(\s*)/g;
    while ((entryMatch = simpleEntryRegex.exec(checksumBlock)) !== null) {
      entries.push({
        prefix: entryMatch[1],
        value: entryMatch[2],
        suffix: entryMatch[3],
      });
    }
  }

  if (index >= entries.length) {
    logger.debug(
      { index, entriesLength: entries.length },
      'Index out of bounds for checksum update',
    );
    return content;
  }

  // Update the checksum at the specified index
  entries[index].value = newChecksum;

  // Reconstruct the block
  const newBlock = entries
    .map((e) => `${e.prefix}'${e.value}'${e.suffix}`)
    .join('');

  return content.replace(regex, `${prefix}${newBlock}${suffix}`);
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
