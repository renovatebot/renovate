import { logger } from '../../../logger';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import type { PackageDependency, PackageFileContent } from '../types';
import type { ChecksumData, SourceData } from './types';

/**
 * Extract checksums from PKGBUILD content
 */
function extractChecksums(content: string): ChecksumData {
  const checksums: ChecksumData = {};

  // Extract sha256sums
  const sha256Regex = /sha256sums(?:_[^=]+)?=\((['"]?)([a-fA-F0-9]{64})\1\)/;
  const sha256Match = sha256Regex.exec(content);
  if (sha256Match) {
    checksums.sha256 = sha256Match[2];
  }

  // Extract sha512sums
  const sha512Regex = /sha512sums(?:_[^=]+)?=\((['"]?)([a-fA-F0-9]{128})\1\)/;
  const sha512Match = sha512Regex.exec(content);
  if (sha512Match) {
    checksums.sha512 = sha512Match[2];
  }

  // Extract b2sums (BLAKE2)
  const b2Regex = /b2sums(?:_[^=]+)?=\((['"]?)([a-fA-F0-9]{128})\1\)/;
  const b2Match = b2Regex.exec(content);
  if (b2Match) {
    checksums.b2 = b2Match[2];
  }

  // Extract md5sums
  const md5Regex = /md5sums(?:_[^=]+)?=\((['"]?)([a-fA-F0-9]{32})\1\)/;
  const md5Match = md5Regex.exec(content);
  if (md5Match) {
    checksums.md5 = md5Match[2];
  }

  return checksums;
}

/**
 * Extract pkgver from PKGBUILD
 */
function extractPkgver(content: string): string | null {
  const pkgverRegex = /^pkgver=(.+)$/m;
  const match = pkgverRegex.exec(content);
  return match ? match[1].trim() : null;
}

/**
 * Parse source URL to extract repository information from GitHub or GitLab
 */
function parseSourceUrl(url: string, pkgver: string): SourceData | null {
  try {
    // Replace ${pkgver} and $pkgver with actual version
    const expandedUrl = url
      .replace(/\$\{pkgver\}/g, pkgver)
      .replace(/\$pkgver/g, pkgver);

    const parsedUrl = new URL(expandedUrl);

    // Check if it's GitHub or GitLab
    const isGitHub = parsedUrl.hostname === 'github.com';
    const isGitLab =
      parsedUrl.hostname === 'gitlab.com' ||
      parsedUrl.hostname.includes('gitlab');

    if (!isGitHub && !isGitLab) {
      return null;
    }

    const pathParts = parsedUrl.pathname.split('/').filter((p) => p);

    if (pathParts.length < 2) {
      return null;
    }

    const owner = pathParts[0];
    const repo = pathParts[1];
    let version: string | undefined;

    if (isGitHub) {
      // Handle GitHub archive URLs: /owner/repo/archive/refs/tags/vX.Y.Z.tar.gz
      if (pathParts[2] === 'archive') {
        if (pathParts[3] === 'refs' && pathParts[4] === 'tags') {
          version = pathParts[5];
        } else {
          version = pathParts[3];
        }

        // Remove file extension
        if (version) {
          version = version.replace(/\.(tar\.gz|tar\.bz2|tar\.xz|zip)$/, '');
        }
      }
      // Handle GitHub release URLs: /owner/repo/releases/download/vX.Y.Z/file.tar.gz
      else if (pathParts[2] === 'releases' && pathParts[3] === 'download') {
        version = pathParts[4];
      }
    } else if (isGitLab) {
      // Handle GitLab archive URLs: /owner/repo/-/archive/vX.Y.Z/repo-vX.Y.Z.tar.gz
      if (pathParts[2] === '-' && pathParts[3] === 'archive') {
        version = pathParts[4];
        // Remove file extension
        if (version) {
          version = version.replace(/\.(tar\.gz|tar\.bz2|tar\.xz|zip)$/, '');
        }
      }
    }

    if (!version) {
      return null;
    }

    return {
      url: expandedUrl,
      version,
      owner,
      repo,
      datasource: isGitHub ? GithubTagsDatasource.id : GitlabTagsDatasource.id,
    };
  } catch {
    return null;
  }
}

/**
 * Extract source URL from PKGBUILD
 */
function extractSource(content: string): string | null {
  // Match source=("url") or source=('url') or source=(url)
  const sourceRegex = /^source(?:_[^=]+)?=\((['"]?)([^'")\s]+)\1\)/m;
  const sourceMatch = sourceRegex.exec(content);
  return sourceMatch ? sourceMatch[2] : null;
}

export function extractPackageFile(content: string): PackageFileContent | null {
  logger.trace('pkgbuild.extractPackageFile()');

  const pkgver = extractPkgver(content);
  if (!pkgver) {
    logger.debug('No pkgver found in PKGBUILD');
    return null;
  }

  const sourceUrl = extractSource(content);
  if (!sourceUrl) {
    logger.debug('No source URL found in PKGBUILD');
    return null;
  }

  // Fall back to URL parsing for GitHub/GitLab
  const sourceData = parseSourceUrl(sourceUrl, pkgver);
  if (!sourceData) {
    logger.debug('Unable to parse source URL or unsupported source');
    return null;
  }

  const checksums = extractChecksums(content);
  if (Object.keys(checksums).length === 0) {
    logger.debug('No checksums found in PKGBUILD');
  }

  const dep: PackageDependency = {
    depName: `${sourceData.owner}/${sourceData.repo}`,
    currentValue: sourceData.version,
    datasource: sourceData.datasource,
    managerData: {
      sourceUrl,
      checksums,
      pkgver,
    },
  };

  return { deps: [dep] };
}
