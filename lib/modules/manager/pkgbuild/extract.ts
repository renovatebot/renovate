import { logger } from '../../../logger';
import { CpanDatasource } from '../../datasource/cpan';
import { ForgejoTagsDatasource } from '../../datasource/forgejo-tags';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GiteaTagsDatasource } from '../../datasource/gitea-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import { NpmDatasource } from '../../datasource/npm';
import { PackagistDatasource } from '../../datasource/packagist';
import { PypiDatasource } from '../../datasource/pypi';
import { RepologyDatasource } from '../../datasource/repology';
import type { PackageDependency, PackageFileContent } from '../types';
import type { ChecksumData, ChecksumEntry, SourceData } from './types';

/**
 * Extract checksums from PKGBUILD content
 * Supports architecture-specific checksums (e.g., sha256sums_x86_64)
 */
function extractChecksums(content: string): ChecksumData {
  const checksums: ChecksumData = {};

  // Helper function to extract all checksums of a given type
  function extractAllChecksumsOfType(
    type: 'sha256' | 'sha512' | 'b2' | 'md5',
    length: number,
  ): ChecksumEntry[] {
    const regex = new RegExp(
      `(${type}sums(?:_([^=]+))?)=\\((['"]?)([a-fA-F0-9]{${length}})\\3\\)`,
      'g',
    );
    const entries: ChecksumEntry[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      entries.push({
        value: match[4],
        suffix: match[2] ? `_${match[2]}` : undefined,
      });
    }

    return entries;
  }

  // Extract sha256sums
  const sha256Entries = extractAllChecksumsOfType('sha256', 64);
  if (sha256Entries.length === 1 && !sha256Entries[0].suffix) {
    // Single non-architecture-specific checksum - use string for backward compatibility
    checksums.sha256 = sha256Entries[0].value;
  } else if (sha256Entries.length > 0) {
    checksums.sha256 = sha256Entries;
  }

  // Extract sha512sums
  const sha512Entries = extractAllChecksumsOfType('sha512', 128);
  if (sha512Entries.length === 1 && !sha512Entries[0].suffix) {
    checksums.sha512 = sha512Entries[0].value;
  } else if (sha512Entries.length > 0) {
    checksums.sha512 = sha512Entries;
  }

  // Extract b2sums (BLAKE2)
  const b2Entries = extractAllChecksumsOfType('b2', 128);
  if (b2Entries.length === 1 && !b2Entries[0].suffix) {
    checksums.b2 = b2Entries[0].value;
  } else if (b2Entries.length > 0) {
    checksums.b2 = b2Entries;
  }

  // Extract md5sums
  const md5Entries = extractAllChecksumsOfType('md5', 32);
  if (md5Entries.length === 1 && !md5Entries[0].suffix) {
    checksums.md5 = md5Entries[0].value;
  } else if (md5Entries.length > 0) {
    checksums.md5 = md5Entries;
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
  const regex = /^(.+?)-([\d.]+.*?)\.(tar\.gz|tar\.bz2|zip)$/;
  const match = regex.exec(filename);
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
  const regex = /-([\d.]+.*?)\.tgz$/;
  const match = regex.exec(filename);
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
  const regex = /^(.+?)-([\d.]+.*?)\.(tar\.gz|tar\.bz2|zip)$/;
  const match = regex.exec(filename);
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
    const regex = /^(.+?)-([\d.]+.*?)\.(tar\.gz|zip)$/;
    const match = regex.exec(filename);
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
 * Parse Gitea URLs (includes Codeberg which runs Gitea/Forgejo)
 * Example: https://gitea.com/owner/repo/archive/v1.0.0.tar.gz
 *          https://codeberg.org/owner/repo/archive/v1.0.0.tar.gz
 */
function parseGiteaUrl(parsedUrl: URL, expandedUrl: string): SourceData | null {
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

    return {
      url: expandedUrl,
      version,
      owner,
      repo,
      datasource: GiteaTagsDatasource.id,
      packageName: `${owner}/${repo}`,
      registryUrl: `${parsedUrl.protocol}//${parsedUrl.hostname}`,
    };
  }

  return null;
}

/**
 * Parse Forgejo URLs
 * Example: https://code.forgejo.org/owner/repo/archive/v1.0.0.tar.gz
 */
function parseForgejoUrl(
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

    return {
      url: expandedUrl,
      version,
      owner,
      repo,
      datasource: ForgejoTagsDatasource.id,
      packageName: `${owner}/${repo}`,
      registryUrl: `${parsedUrl.protocol}//${parsedUrl.hostname}`,
    };
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

    // 3. Gitea detection (includes Codeberg which runs Gitea/Forgejo)
    if (
      parsedUrl.hostname === 'gitea.com' ||
      parsedUrl.hostname === 'codeberg.org' ||
      parsedUrl.hostname.includes('gitea')
    ) {
      const result = parseGiteaUrl(parsedUrl, expandedUrl);
      if (result) {
        return result;
      }
    }

    // 4. Forgejo detection
    if (
      parsedUrl.hostname === 'code.forgejo.org' ||
      parsedUrl.hostname.includes('forgejo')
    ) {
      const result = parseForgejoUrl(parsedUrl, expandedUrl);
      if (result) {
        return result;
      }
    }

    // 5. PyPI detection
    if (
      parsedUrl.hostname === 'files.pythonhosted.org' ||
      parsedUrl.hostname === 'pypi.org' ||
      parsedUrl.hostname === 'pypi.python.org'
    ) {
      return parsePyPIUrl(parsedUrl, expandedUrl);
    }

    // 6. npm detection
    if (
      parsedUrl.hostname === 'registry.npmjs.org' ||
      parsedUrl.hostname === 'registry.npmjs.com'
    ) {
      return parseNpmUrl(parsedUrl, expandedUrl);
    }

    // 7. CPAN detection
    if (
      parsedUrl.hostname === 'cpan.metacpan.org' ||
      parsedUrl.hostname.includes('cpan')
    ) {
      return parseCPANUrl(parsedUrl, expandedUrl);
    }

    // 8. Packagist detection
    if (parsedUrl.hostname.includes('packagist')) {
      return parsePackagistUrl(parsedUrl, expandedUrl);
    }

    // 9. Generic Git repository (gitea, forgejo, cgit, etc.)
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

/**
 * Extract package name from source URL filename as a fallback
 * Example: "https://example.com/foo-bar-1.2.3.tar.gz" -> "foo-bar"
 */
function extractPackageNameFromFilename(sourceUrl: string): string | null {
  try {
    // Get the filename from the URL
    const urlPath = sourceUrl.split('?')[0]; // Remove query params
    const filename = urlPath.split('/').pop();

    if (!filename) {
      return null;
    }

    // Match pattern: packagename-version.ext
    // Common extensions: .tar.gz, .tar.bz2, .tar.xz, .zip, .tgz
    const regex = /^(.+?)-(v?[\d.]+[^-]*)\.(tar\.gz|tar\.bz2|tar\.xz|zip|tgz)$/;
    const match = regex.exec(filename);

    if (match) {
      return match[1];
    }

    // Try simpler pattern without version
    const simpleRegex = /^(.+)\.(tar\.gz|tar\.bz2|tar\.xz|zip|tgz)$/;
    const simpleMatch = simpleRegex.exec(filename);

    if (simpleMatch) {
      return simpleMatch[1];
    }

    return null;
  } catch {
    return null;
  }
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
      } else {
        // Last resort: extract package name from source URL filename
        const fallbackName = extractPackageNameFromFilename(sourceUrl);
        if (fallbackName) {
          logger.debug(
            `Using Repology datasource with filename-based fallback: ${fallbackName}`,
          );
          sourceData = {
            url: sourceUrl,
            version: pkgver,
            datasource: RepologyDatasource.id,
            packageName: `aur/${fallbackName}`,
          };
        }
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

  // Add registryUrls for self-hosted instances
  if (sourceData.registryUrl) {
    dep.registryUrls = [sourceData.registryUrl];
  }

  return { deps: [dep] };
}
