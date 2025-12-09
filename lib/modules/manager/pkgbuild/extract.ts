import { logger } from '../../../logger';
import { CpanDatasource } from '../../datasource/cpan';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import { NpmDatasource } from '../../datasource/npm';
import { PackagistDatasource } from '../../datasource/packagist';
import { PypiDatasource } from '../../datasource/pypi';
import { RepologyDatasource } from '../../datasource/repology';
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
 * Extract pkgname from PKGBUILD
 */
function extractPkgname(content: string): string | null {
  const pkgnameRegex = /^pkgname=(.+)$/m;
  const match = pkgnameRegex.exec(content);
  return match ? match[1].trim() : null;
}

/**
 * Extract Repology configuration from comment
 * Example: # renovate: repology=aur/packagename
 */
function extractRepologyConfig(content: string): string | null {
  const repologyRegex = /#\s*renovate:\s*repology=(\S+)/;
  const match = repologyRegex.exec(content);
  return match ? match[1].trim() : null;
}

/**
 * Parse GitHub URLs
 */
function parseGitHubUrl(
  parsedUrl: URL,
  expandedUrl: string,
): SourceData | null {
  const pathParts = parsedUrl.pathname.split('/').filter((p) => p);

  if (pathParts.length < 2) {
    return null;
  }

  const owner = pathParts[0];
  const repo = pathParts[1];
  let version: string | undefined;

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

  if (!version) {
    return null;
  }

  return {
    url: expandedUrl,
    version,
    owner,
    repo,
    datasource: GithubTagsDatasource.id,
  };
}

/**
 * Parse GitLab URLs
 */
function parseGitLabUrl(
  parsedUrl: URL,
  expandedUrl: string,
): SourceData | null {
  const pathParts = parsedUrl.pathname.split('/').filter((p) => p);

  if (pathParts.length < 2) {
    return null;
  }

  const owner = pathParts[0];
  const repo = pathParts[1];
  let version: string | undefined;

  // Handle GitLab archive URLs: /owner/repo/-/archive/vX.Y.Z/repo-vX.Y.Z.tar.gz
  if (pathParts[2] === '-' && pathParts[3] === 'archive') {
    version = pathParts[4];
    // Remove file extension
    if (version) {
      version = version.replace(/\.(tar\.gz|tar\.bz2|tar\.xz|zip)$/, '');
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
    datasource: GitlabTagsDatasource.id,
  };
}

/**
 * Parse PyPI URLs
 * Example: https://files.pythonhosted.org/packages/.../packagename-1.0.0.tar.gz
 */
function parsePyPIUrl(parsedUrl: URL, expandedUrl: string): SourceData | null {
  const pathParts = parsedUrl.pathname.split('/').filter((p) => p);

  // Extract filename from URL
  const filename = pathParts[pathParts.length - 1];
  if (!filename) {
    return null;
  }

  // Match pattern: packagename-version.tar.gz or similar
  const match = filename.match(/^(.+?)-([\d.]+.*?)\.(tar\.gz|tar\.bz2|zip)$/);
  if (!match) {
    return null;
  }

  const packageName = match[1];
  const version = match[2];

  return {
    url: expandedUrl,
    version,
    datasource: PypiDatasource.id,
    packageName,
  };
}

/**
 * Parse npm registry URLs
 * Example: https://registry.npmjs.org/packagename/-/packagename-1.0.0.tgz
 */
function parseNpmUrl(parsedUrl: URL, expandedUrl: string): SourceData | null {
  const pathParts = parsedUrl.pathname.split('/').filter((p) => p);

  if (pathParts.length < 2) {
    return null;
  }

  // Handle scoped packages: @scope/package/-/package-1.0.0.tgz
  let packageName: string;
  let filenameIndex: number;

  if (pathParts[0].startsWith('@')) {
    // Scoped package
    packageName = `${pathParts[0]}/${pathParts[1]}`;
    filenameIndex = 3;
  } else {
    // Regular package
    packageName = pathParts[0];
    filenameIndex = 2;
  }

  if (pathParts.length <= filenameIndex) {
    return null;
  }

  // Extract version from filename
  const filename = pathParts[filenameIndex];
  const match = filename.match(/-([\d.]+.*?)\.tgz$/);
  if (!match) {
    return null;
  }

  const version = match[1];

  return {
    url: expandedUrl,
    version,
    datasource: NpmDatasource.id,
    packageName,
  };
}

/**
 * Parse CPAN URLs
 * Example: https://cpan.metacpan.org/authors/id/.../Module-Name-1.0.tar.gz
 */
function parseCPANUrl(parsedUrl: URL, expandedUrl: string): SourceData | null {
  const pathParts = parsedUrl.pathname.split('/').filter((p) => p);

  // Extract filename from URL
  const filename = pathParts[pathParts.length - 1];
  if (!filename) {
    return null;
  }

  // Match pattern: Module-Name-version.tar.gz
  const match = filename.match(/^(.+?)-([\d.]+.*?)\.(tar\.gz|tar\.bz2|zip)$/);
  if (!match) {
    return null;
  }

  // Convert Module-Name to Module::Name for CPAN
  const moduleName = match[1].replace(/-/g, '::');
  const version = match[2];

  return {
    url: expandedUrl,
    version,
    datasource: CpanDatasource.id,
    packageName: moduleName,
  };
}

/**
 * Parse Packagist URLs
 * Example: https://packagist.org/packages/vendor/package
 */
function parsePackagistUrl(
  parsedUrl: URL,
  expandedUrl: string,
): SourceData | null {
  const pathParts = parsedUrl.pathname.split('/').filter((p) => p);

  // Look for vendor/package pattern in URL or filename
  if (pathParts.length >= 3 && pathParts[0] === 'packages') {
    const vendor = pathParts[1];
    const packageName = pathParts[2];

    // Try to extract version from URL or return null to let Renovate fetch it
    return {
      url: expandedUrl,
      version: '', // Packagist will need to fetch version info
      owner: vendor,
      repo: packageName,
      datasource: PackagistDatasource.id,
    };
  }

  // Try to parse from download URL with filename
  const filename = pathParts[pathParts.length - 1];
  if (filename) {
    const match = filename.match(/^(.+?)-([\d.]+.*?)\.(tar\.gz|zip)$/);
    if (match) {
      const packageName = match[1];
      const version = match[2];

      return {
        url: expandedUrl,
        version,
        owner: packageName,
        repo: packageName,
        datasource: PackagistDatasource.id,
      };
    }
  }

  return null;
}

/**
 * Parse generic Git repository URLs
 * Example: https://git.example.com/repo.git or gitea/forgejo archive URLs
 */
function parseGenericGitUrl(
  parsedUrl: URL,
  expandedUrl: string,
): SourceData | null {
  const pathParts = parsedUrl.pathname.split('/').filter((p) => p);

  // Handle archive URLs: /owner/repo/archive/tag.tar.gz
  if (pathParts.includes('archive') && pathParts.length >= 4) {
    const archiveIndex = pathParts.indexOf('archive');
    const owner = pathParts[archiveIndex - 2];
    const repo = pathParts[archiveIndex - 1];
    let version = pathParts[archiveIndex + 1];

    // Remove file extension
    if (version) {
      version = version.replace(/\.(tar\.gz|tar\.bz2|tar\.xz|zip)$/, '');
    }

    if (!version) {
      return null;
    }

    // Construct full git URL for git-tags datasource
    const gitUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}/${owner}/${repo}.git`;

    return {
      url: expandedUrl,
      version,
      owner,
      repo,
      datasource: GitTagsDatasource.id,
      packageName: gitUrl,
    };
  }

  // Handle direct .git URLs
  if (parsedUrl.pathname.endsWith('.git')) {
    const repoPath = parsedUrl.pathname.replace(/\.git$/, '');
    const parts = repoPath.split('/').filter((p) => p);

    if (parts.length >= 2) {
      const owner = parts[parts.length - 2];
      const repo = parts[parts.length - 1];
      const gitUrl = expandedUrl;

      return {
        url: expandedUrl,
        version: '', // Will be determined by git-tags datasource
        owner,
        repo,
        datasource: GitTagsDatasource.id,
        packageName: gitUrl,
      };
    }
  }

  return null;
}

/**
 * Parse source URL to extract repository information from various sources
 */
function parseSourceUrl(url: string, pkgver: string): SourceData | null {
  try {
    // Replace ${pkgver} and $pkgver with actual version
    const expandedUrl = url
      .replace(/\$\{pkgver\}/g, pkgver)
      .replace(/\$pkgver/g, pkgver);

    const parsedUrl = new URL(expandedUrl);

    // 1. GitHub detection
    if (parsedUrl.hostname === 'github.com') {
      return parseGitHubUrl(parsedUrl, expandedUrl);
    }

    // 2. GitLab detection
    if (
      parsedUrl.hostname === 'gitlab.com' ||
      parsedUrl.hostname.includes('gitlab')
    ) {
      return parseGitLabUrl(parsedUrl, expandedUrl);
    }

    // 3. PyPI detection
    if (
      parsedUrl.hostname === 'files.pythonhosted.org' ||
      parsedUrl.hostname === 'pypi.org' ||
      parsedUrl.hostname === 'pypi.python.org'
    ) {
      return parsePyPIUrl(parsedUrl, expandedUrl);
    }

    // 4. npm detection
    if (
      parsedUrl.hostname === 'registry.npmjs.org' ||
      parsedUrl.hostname === 'registry.npmjs.com'
    ) {
      return parseNpmUrl(parsedUrl, expandedUrl);
    }

    // 5. CPAN detection
    if (
      parsedUrl.hostname === 'cpan.metacpan.org' ||
      parsedUrl.hostname.includes('cpan')
    ) {
      return parseCPANUrl(parsedUrl, expandedUrl);
    }

    // 6. Packagist detection
    if (parsedUrl.hostname.includes('packagist')) {
      return parsePackagistUrl(parsedUrl, expandedUrl);
    }

    // 7. Generic Git repository (gitea, forgejo, cgit, etc.)
    if (
      parsedUrl.pathname.includes('/archive/') ||
      parsedUrl.pathname.endsWith('.git')
    ) {
      return parseGenericGitUrl(parsedUrl, expandedUrl);
    }

    return null;
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

  // Parse URL to detect datasource
  let sourceData = parseSourceUrl(sourceUrl, pkgver);

  // If no datasource detected, try Repology as fallback
  if (!sourceData) {
    // Check for manual Repology configuration first
    const repologyConfig = extractRepologyConfig(content);
    if (repologyConfig) {
      logger.debug(
        `Using Repology datasource with manual config: ${repologyConfig}`,
      );
      sourceData = {
        url: sourceUrl,
        version: pkgver,
        datasource: RepologyDatasource.id,
        packageName: repologyConfig,
      };
    } else {
      // Try automatic Repology detection using pkgname
      const pkgname = extractPkgname(content);
      if (pkgname) {
        logger.debug(
          `Using Repology datasource as fallback for package: ${pkgname}`,
        );
        // Default to AUR repository for Arch packages
        sourceData = {
          url: sourceUrl,
          version: pkgver,
          datasource: RepologyDatasource.id,
          packageName: `aur/${pkgname}`,
        };
      }
    }
  }

  if (!sourceData) {
    logger.debug('Unable to parse source URL or unsupported source');
    return null;
  }

  const checksums = extractChecksums(content);
  if (Object.keys(checksums).length === 0) {
    logger.debug('No checksums found in PKGBUILD');
  }

  const dep: PackageDependency = {
    depName: sourceData.packageName ?? `${sourceData.owner}/${sourceData.repo}`,
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
