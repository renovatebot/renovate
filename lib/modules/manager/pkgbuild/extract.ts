import { logger } from '../../../logger/index.ts';
import { CpanDatasource } from '../../datasource/cpan/index.ts';
import { ForgejoTagsDatasource } from '../../datasource/forgejo-tags/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GiteaTagsDatasource } from '../../datasource/gitea-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';
import { PackagistDatasource } from '../../datasource/packagist/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';
import { RepologyDatasource } from '../../datasource/repology/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import type {
  ChecksumData,
  ChecksumEntry,
  MultiSourceData,
  SourceData,
  SourceEntry,
} from './types.ts';

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
 * Handles comments, quotes, and bash variables
 */
function extractPkgver(content: string): string | null {
  const pkgverRegex = /^pkgver=(.+)$/m;
  const match = pkgverRegex.exec(content);
  if (!match) {
    return null;
  }

  let pkgver = match[1].trim();

  // Remove inline comments (everything after #, but keep the version part before it)
  const commentIndex = pkgver.indexOf('#');
  if (commentIndex !== -1) {
    pkgver = pkgver.substring(0, commentIndex).trim();
  }

  // Remove surrounding quotes
  pkgver = pkgver.replace(/^["']|["']$/g, '');

  // Skip versions with unresolved bash variables
  if (pkgver.includes('${') || pkgver.includes('$_') || pkgver.includes('$(')) {
    logger.debug(`Skipping version with bash variables: ${pkgver}`);
    return null;
  }

  return pkgver;
}

/**
 * Extract pkgname from PKGBUILD
 * Handles comments, quotes, and bash variables
 */
function extractPkgname(content: string): string | null {
  const pkgnameRegex = /^pkgname=(.+)$/m;
  const match = pkgnameRegex.exec(content);
  if (!match) {
    return null;
  }

  let pkgname = match[1].trim();

  // Remove inline comments (everything after #)
  const commentIndex = pkgname.indexOf('#');
  if (commentIndex !== -1) {
    pkgname = pkgname.substring(0, commentIndex).trim();
  }

  // Remove surrounding quotes
  pkgname = pkgname.replace(/^["']|["']$/g, '');

  // Skip packages with unresolved bash variables
  // These need variable expansion which is complex in PKGBUILD context
  if (
    pkgname.includes('${') ||
    pkgname.includes('$_') ||
    pkgname.includes('$(')
  ) {
    logger.debug(`Skipping package with bash variables: ${pkgname}`);
    return null;
  }

  // Skip array-style package names for now
  if (pkgname.startsWith('(')) {
    logger.debug(`Skipping array-style package name: ${pkgname}`);
    return null;
  }

  return pkgname;
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
 * Extract source URL from PKGBUILD (first source only, for backward compatibility)
 */
/**
 * Extract variable definitions from PKGBUILD
 */
function extractVariables(content: string): Map<string, string> {
  const vars = new Map<string, string>();

  // Extract common variables
  const patterns = [
    /^url=["']?([^"'\n]+)["']?$/m,
    /^pkgname=["']?([^"'\n]+)["']?$/m,
    /^_pkgname=["']?([^"'\n]+)["']?$/m,
    /^_name=["']?([^"'\n]+)["']?$/m,
    /^pkgver=["']?([^"'\n#]+)["']?/m,
    /^_pkgver=["']?([^"'\n#]+)["']?/m,
  ];

  const varNames = ['url', 'pkgname', '_pkgname', '_name', 'pkgver', '_pkgver'];

  patterns.forEach((pattern, i) => {
    const match = pattern.exec(content);
    if (match) {
      vars.set(varNames[i], match[1].trim());
    }
  });

  return vars;
}

/**
 * Expand bash variables in a string using extracted variable values
 * Handles: ${var}, $var, and ${var%-suffix} patterns
 */
function expandVariables(str: string, vars: Map<string, string>): string {
  let expanded = str;

  // Expand ${var%-suffix} and ${var#prefix} (parameter substitution)
  // Match: ${varname%-suffix} or ${varname#prefix}
  expanded = expanded.replace(
    /\$\{([a-zA-Z_][a-zA-Z0-9_]*)(%|#)(.*?)\}/g,
    (match, varName, operator, operand) => {
      const value = vars.get(varName);
      if (!value) {
        return match;
      }

      if (!operand) {
        return value;
      }

      // Handle suffix removal: ${var%-suffix}
      if (operator === '%') {
        const suffix = operand;
        return value.endsWith(suffix) ? value.slice(0, -suffix.length) : value;
      }
      // Handle prefix removal: ${var#prefix}
      if (operator === '#') {
        return value.startsWith(operand) ? value.slice(operand.length) : value;
      }

      return value;
    },
  );

  // Expand simple ${var}
  expanded = expanded.replace(
    /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g,
    (match, varName) => {
      return vars.get(varName) ?? match;
    },
  );

  // Expand simple $var
  expanded = expanded.replace(
    /\$([a-zA-Z_][a-zA-Z0-9_]*)/g,
    (match, varName) => {
      return vars.get(varName) ?? match;
    },
  );

  return expanded;
}

function extractSource(content: string): string | null {
  // Match the entire source=(...) block, handling multi-line
  const sourceBlockRegex = /^source(?:_[^=]+)?=\(([\s\S]*?)\)/m;
  const blockMatch = sourceBlockRegex.exec(content);

  if (!blockMatch) {
    return null;
  }

  const sourceBlock = blockMatch[1];

  // Extract the first entry from the block (quoted or unquoted)
  const entryRegex = /(['"])([^'"]+)\1|([^\s'"()]+)/;
  const entryMatch = entryRegex.exec(sourceBlock);

  if (!entryMatch) {
    return null;
  }

  let sourceUrl = entryMatch[2] ?? entryMatch[3];

  // Handle filename::url format - extract just the URL part after ::
  const filenameSeparator = sourceUrl.indexOf('::');
  if (filenameSeparator !== -1) {
    sourceUrl = sourceUrl.substring(filenameSeparator + 2);
  }

  // Expand bash variables in the URL
  const vars = extractVariables(content);
  sourceUrl = expandVariables(sourceUrl, vars);

  // Skip URLs that still contain unexpanded variables
  if (
    sourceUrl.includes('${') ||
    sourceUrl.includes('$_') ||
    sourceUrl.includes('$(')
  ) {
    logger.debug(`Skipping source URL with unexpanded variables: ${sourceUrl}`);
    return null;
  }

  return sourceUrl;
}

/**
 * Extract all sources from PKGBUILD source array
 * Handles multi-line arrays and tracks which sources use ${pkgver}
 */
function extractAllSources(content: string): SourceEntry[] {
  const sources: SourceEntry[] = [];

  // Match the entire source=(...) block, handling multi-line
  const sourceBlockRegex = /^source(?:_[^=]+)?=\(([\s\S]*?)\)/m;
  const blockMatch = sourceBlockRegex.exec(content);

  if (!blockMatch) {
    return sources;
  }

  const sourceBlock = blockMatch[1];

  // Extract individual entries from the block
  // Matches quoted strings or unquoted words
  const entryRegex = /(['"])([^'"]+)\1|([^\s'"()]+)/g;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(sourceBlock)) !== null) {
    const url = match[2] ?? match[3];
    if (url) {
      sources.push({
        url,
        usesPkgver:
          url.includes('$' + '{pkgver}') ||
          url.includes('$pkgver') ||
          url.includes('$' + '{_pkgver}') ||
          url.includes('$_pkgver'),
      });
    }
  }

  return sources;
}

/**
 * Extract all checksums of a given type as an array (including SKIP)
 */
function extractChecksumArray(
  content: string,
  type: 'sha256' | 'sha512' | 'b2' | 'md5',
): string[] | null {
  // Match the entire checksums block
  const regex = new RegExp(`^${type}sums(?:_[^=]+)?=\\(([\\s\\S]*?)\\)`, 'm');
  const match = regex.exec(content);

  if (!match) {
    return null;
  }

  const checksumBlock = match[1];
  const checksums: string[] = [];

  // Extract individual checksums (hex values or SKIP)
  const entryRegex = /(['"])([^'"]+)\1|([^\s'"()]+)/g;
  let entryMatch: RegExpExecArray | null;

  while ((entryMatch = entryRegex.exec(checksumBlock)) !== null) {
    const value = entryMatch[2] ?? entryMatch[3];
    if (value) {
      checksums.push(value);
    }
  }

  return checksums.length > 0 ? checksums : null;
}

/**
 * Extract multi-source data from PKGBUILD
 */
function extractMultiSourceData(content: string): MultiSourceData {
  return {
    sources: extractAllSources(content),
    checksums: {
      sha256: extractChecksumArray(content, 'sha256') ?? undefined,
      sha512: extractChecksumArray(content, 'sha512') ?? undefined,
      b2: extractChecksumArray(content, 'b2') ?? undefined,
      md5: extractChecksumArray(content, 'md5') ?? undefined,
    },
  };
}

/**
 * Extract package name from source URL filename as a fallback
 * Example: "https://example.com/foo-bar-1.2.3.tar.gz" -> "foo-bar"
 */
function extractPackageNameFromFilename(sourceUrl: string): string | null {
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

  // Extract multi-source data for handling multiple sources with pkgver
  const multiSourceData = extractMultiSourceData(content);
  logger.debug({ multiSourceData }, 'Extracted multi-source data');

  const dep: PackageDependency = {
    depName: sourceData.packageName ?? `${sourceData.owner}/${sourceData.repo}`,
    currentValue: sourceData.version,
    datasource: sourceData.datasource,
    managerData: {
      sourceUrl,
      checksums,
      pkgver,
      multiSource: multiSourceData,
    },
  };

  // Add registryUrls for self-hosted instances
  if (sourceData.registryUrl) {
    dep.registryUrls = [sourceData.registryUrl];
  }

  return { deps: [dep] };
}
