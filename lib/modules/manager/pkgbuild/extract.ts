import is from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
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
 * Extract all checksums of a given type from PKGBUILD content.
 * Supports architecture-specific checksums (e.g., sha256sums_x86_64).
 */
function extractAllChecksumsOfType(
  content: string,
  type: 'sha256' | 'sha512' | 'b2' | 'md5',
  length: number,
): ChecksumEntry[] {
  // RE2 doesn't support backreferences, so try each quote style separately
  const entries: ChecksumEntry[] = [];
  let match: RegExpExecArray | null;

  // Try single-quoted checksums: sha256sums=('abc...') or sha256sums_x86_64=('abc...')
  const singleQuoteRegex = regEx(
    `(${type}sums(?:_([^=]+))?)=\\('([a-fA-F0-9]{${length}})'\\)`,
    'g',
  );
  while ((match = singleQuoteRegex.exec(content)) !== null) {
    entries.push({
      value: match[3],
      suffix: match[2] ? `_${match[2]}` : undefined,
    });
  }

  // Try double-quoted checksums: sha256sums=("abc...")
  const doubleQuoteRegex = regEx(
    `(${type}sums(?:_([^=]+))?)=\\("([a-fA-F0-9]{${length}})"\\)`,
    'g',
  );
  while ((match = doubleQuoteRegex.exec(content)) !== null) {
    entries.push({
      value: match[3],
      suffix: match[2] ? `_${match[2]}` : undefined,
    });
  }

  // Try unquoted checksums: sha256sums=(abc...)
  const unquotedRegex = regEx(
    `(${type}sums(?:_([^=]+))?)=\\(([a-fA-F0-9]{${length}})\\)`,
    'g',
  );
  while ((match = unquotedRegex.exec(content)) !== null) {
    entries.push({
      value: match[3],
      suffix: match[2] ? `_${match[2]}` : undefined,
    });
  }

  return entries;
}

/**
 * Normalize checksum entries into a single value or an array.
 * Returns the plain string for a single non-arch-specific checksum,
 * the full array for multiple/arch-specific entries, or undefined if empty.
 */
function normalizeChecksumEntries(
  entries: ChecksumEntry[],
): string | ChecksumEntry[] | undefined {
  if (entries.length === 1 && !entries[0].suffix) {
    return entries[0].value;
  }
  if (entries.length > 0) {
    return entries;
  }
  return undefined;
}

const checksumTypes: {
  type: 'sha256' | 'sha512' | 'b2' | 'md5';
  length: number;
}[] = [
  { type: 'sha256', length: 64 },
  { type: 'sha512', length: 128 },
  { type: 'b2', length: 128 },
  { type: 'md5', length: 32 },
];

/**
 * Extract checksums from PKGBUILD content
 * Supports architecture-specific checksums (e.g., sha256sums_x86_64)
 */
function extractChecksums(content: string): ChecksumData {
  const checksums: ChecksumData = {};

  for (const { type, length } of checksumTypes) {
    const entries = extractAllChecksumsOfType(content, type, length);
    const normalized = normalizeChecksumEntries(entries);
    if (normalized !== undefined) {
      checksums[type] = normalized;
    }
  }

  return checksums;
}

/**
 * Extract pkgver from PKGBUILD
 * Handles comments, quotes, and bash variables
 */
function extractPkgver(content: string): string | null {
  const pkgverRegex = regEx(/^pkgver=(.+)$/m);
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
  pkgver = pkgver.replace(regEx(/^["']|["']$/g), '');

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
  const pkgnameRegex = regEx(/^pkgname=(.+)$/m);
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
  pkgname = pkgname.replace(regEx(/^["']|["']$/g), '');

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
 * Extract custom datasource/depName configuration from comment
 * Example: # renovate: datasource=cpan depName=LWP
 * Example: # renovate: datasource=github-tags depName=nginx/nginx extractVersion=^release-(?<version>.+)$
 * Also supports legacy format: # renovate: repology=aur/packagename
 */
function extractCustomConfig(content: string): {
  datasource: string;
  depName: string;
  additionalProps?: Record<string, string>;
} | null {
  // Match general format: # renovate: datasource=<ds> depName=<name> [key=value...]
  const customRegex = regEx(
    /#\s*renovate:\s*datasource=(\S+)\s+depName=(\S+)(.*)?/,
  );
  const customMatch = customRegex.exec(content);
  if (customMatch) {
    const result: {
      datasource: string;
      depName: string;
      additionalProps?: Record<string, string>;
    } = {
      datasource: customMatch[1].trim(),
      depName: customMatch[2].trim(),
    };

    // Parse additional key=value pairs (e.g., extractVersion, versioning)
    const rest = customMatch[3]?.trim();
    if (rest) {
      const props: Record<string, string> = {};
      const kvRegex = regEx(/(\w+)=(\S+)/g);
      let kvMatch: RegExpExecArray | null;
      while ((kvMatch = kvRegex.exec(rest)) !== null) {
        props[kvMatch[1]] = kvMatch[2];
      }
      if (Object.keys(props).length > 0) {
        result.additionalProps = props;
      }
    }

    return result;
  }

  return null;
}

/**
 * Extract Repology configuration from comment (legacy format)
 * Example: # renovate: repology=aur/packagename
 */
function extractRepologyConfig(content: string): string | null {
  const repologyRegex = regEx(/#\s*renovate:\s*repology=(\S+)/);
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
  const pathParts = parsedUrl.pathname.split('/').filter(is.nonEmptyString);

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
      version = version.replace(regEx(/\.(tar\.gz|tar\.bz2|tar\.xz|zip)$/), '');
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
  const pathParts = parsedUrl.pathname.split('/').filter(is.nonEmptyString);

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
      version = version.replace(regEx(/\.(tar\.gz|tar\.bz2|tar\.xz|zip)$/), '');
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
  const pathParts = parsedUrl.pathname.split('/').filter(is.nonEmptyString);

  // Extract filename from URL
  const filename = pathParts[pathParts.length - 1];
  if (!filename) {
    return null;
  }

  // Match pattern: packagename-version.tar.gz or similar
  const pypiRegex = regEx(/^(.+?)-([\d.]+.*?)\.(tar\.gz|tar\.bz2|zip)$/);
  const match = pypiRegex.exec(filename);
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
  const pathParts = parsedUrl.pathname.split('/').filter(is.nonEmptyString);

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
  const npmRegex = regEx(/-([\d.]+.*?)\.tgz$/);
  const match = npmRegex.exec(filename);
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
  const pathParts = parsedUrl.pathname.split('/').filter(is.nonEmptyString);

  // Extract filename from URL
  const filename = pathParts[pathParts.length - 1];
  if (!filename) {
    return null;
  }

  // Match pattern: Module-Name-version.tar.gz
  const cpanRegex = regEx(/^(.+?)-([\d.]+.*?)\.(tar\.gz|tar\.bz2|zip)$/);
  const match = cpanRegex.exec(filename);
  if (!match) {
    return null;
  }

  // Convert Module-Name to Module::Name for CPAN
  const moduleName = match[1].replace(regEx(/-/g), '::');
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
  const pathParts = parsedUrl.pathname.split('/').filter(is.nonEmptyString);

  // Look for vendor/package pattern in URL or filename
  if (pathParts.length >= 3 && pathParts[0] === 'packages') {
    const vendor = pathParts[1];
    const packageName = pathParts[2];

    // Version not present in this URL format; let Renovate fetch it via datasource
    return {
      url: expandedUrl,
      owner: vendor,
      repo: packageName,
      datasource: PackagistDatasource.id,
    };
  }

  // Try to parse from download URL with filename
  const filename = pathParts[pathParts.length - 1];
  if (filename) {
    const packagistRegex = regEx(/^(.+?)-([\d.]+.*?)\.(tar\.gz|zip)$/);
    const match = packagistRegex.exec(filename);
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
  // Handle archive URLs: /owner/repo/archive/tag.tar.gz
  const archiveMatch = regEx(/^\/([^/]+)\/([^/]+)\/archive\/(.+)$/).exec(
    parsedUrl.pathname,
  );
  if (!archiveMatch) {
    return null;
  }

  const [, owner, repo, versionWithExt] = archiveMatch;
  const version = versionWithExt.replace(
    regEx(/\.(tar\.gz|tar\.bz2|tar\.xz|zip)$/),
    '',
  );

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

/**
 * Parse Forgejo URLs
 * Example: https://code.forgejo.org/owner/repo/archive/v1.0.0.tar.gz
 */
function parseForgejoUrl(
  parsedUrl: URL,
  expandedUrl: string,
): SourceData | null {
  // Handle archive URLs: /owner/repo/archive/tag.tar.gz
  const archiveMatch = regEx(/^\/([^/]+)\/([^/]+)\/archive\/(.+)$/).exec(
    parsedUrl.pathname,
  );
  if (!archiveMatch) {
    return null;
  }

  const [, owner, repo, versionWithExt] = archiveMatch;
  const version = versionWithExt.replace(
    regEx(/\.(tar\.gz|tar\.bz2|tar\.xz|zip)$/),
    '',
  );

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

/**
 * Parse generic Git repository URLs
 * Example: https://git.example.com/repo.git or gitea/forgejo archive URLs
 */
function parseGenericGitUrl(
  parsedUrl: URL,
  expandedUrl: string,
): SourceData | null {
  // Handle archive URLs: /owner/repo/archive/tag.tar.gz
  const archiveMatch = regEx(/^\/([^/]+)\/([^/]+)\/archive\/(.+)$/).exec(
    parsedUrl.pathname,
  );
  if (archiveMatch) {
    const [, owner, repo, versionWithExt] = archiveMatch;
    const version = versionWithExt.replace(
      regEx(/\.(tar\.gz|tar\.bz2|tar\.xz|zip)$/),
      '',
    );

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

  // Handle direct .git URLs: /owner/repo.git
  const gitMatch = regEx(/\/([^/]+)\/([^/]+)\.git$/).exec(parsedUrl.pathname);
  if (gitMatch) {
    const [, owner, repo] = gitMatch;

    return {
      url: expandedUrl,
      owner,
      repo,
      datasource: GitTagsDatasource.id,
      packageName: expandedUrl,
    };
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
      .replace(regEx(/\$\{pkgver\}/g), pkgver)
      .replace(regEx(/\$pkgver/g), pkgver);

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
 * Extract variable definitions from PKGBUILD
 */
function extractVariables(content: string): Map<string, string> {
  const vars = new Map<string, string>();

  // Extract common variables
  const patterns = [
    regEx(/^url=["']?([^"'\n]+)["']?$/m),
    regEx(/^pkgname=["']?([^"'\n]+)["']?$/m),
    regEx(/^_pkgname=["']?([^"'\n]+)["']?$/m),
    regEx(/^_name=["']?([^"'\n]+)["']?$/m),
    regEx(/^pkgver=["']?([^"'\n#]+)["']?/m),
    regEx(/^_pkgver=["']?([^"'\n#]+)["']?/m),
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
    regEx(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)(%|#)(.*?)\}/g),
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
      return value.startsWith(operand) ? value.slice(operand.length) : value;
    },
  );

  // Expand simple ${var}
  expanded = expanded.replace(
    regEx(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g),
    (match, varName) => {
      return vars.get(varName) ?? match;
    },
  );

  // Expand simple $var
  expanded = expanded.replace(
    regEx(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g),
    (match, varName) => {
      return vars.get(varName) ?? match;
    },
  );

  return expanded;
}

/**
 * Extract all quoted or unquoted entries from a PKGBUILD array block.
 * RE2 doesn't support backreferences, so we match single-quoted, double-quoted,
 * and unquoted tokens separately, then merge them in order of appearance.
 */
function extractBlockEntries(block: string): string[] {
  const found: { index: number; value: string }[] = [];
  let entryMatch: RegExpExecArray | null;

  // Match single-quoted entries
  const singleQuoteRegex = regEx(/'([^']+)'/g);
  while ((entryMatch = singleQuoteRegex.exec(block)) !== null) {
    found.push({ index: entryMatch.index, value: entryMatch[1] });
  }

  // Match double-quoted entries
  const doubleQuoteRegex = regEx(/"([^"]+)"/g);
  while ((entryMatch = doubleQuoteRegex.exec(block)) !== null) {
    found.push({ index: entryMatch.index, value: entryMatch[1] });
  }

  // Match unquoted entries (tokens not inside quotes)
  // First, build a set of ranges covered by quoted entries
  const coveredRanges: { start: number; end: number }[] = [];
  const allQuotesRegex = regEx(/'[^']*'|"[^"]*"/g);
  while ((entryMatch = allQuotesRegex.exec(block)) !== null) {
    coveredRanges.push({
      start: entryMatch.index,
      end: entryMatch.index + entryMatch[0].length,
    });
  }

  const unquotedRegex = regEx(/([^\s'"()]+)/g);
  while ((entryMatch = unquotedRegex.exec(block)) !== null) {
    const pos = entryMatch.index;
    // Only include if not inside a quoted range
    const insideQuote = coveredRanges.some(
      (r) => pos >= r.start && pos < r.end,
    );
    if (!insideQuote) {
      found.push({ index: pos, value: entryMatch[1] });
    }
  }

  // Sort by position to preserve original order
  found.sort((a, b) => a.index - b.index);

  return found.map((f) => f.value);
}

function extractSource(content: string): string | null {
  // Match the entire source=(...) block, handling multi-line
  const sourceBlockRegex = regEx(/^source(?:_[^=]+)?=\(([\s\S]*?)\)/m);
  const blockMatch = sourceBlockRegex.exec(content);

  if (!blockMatch) {
    return null;
  }

  const sourceBlock = blockMatch[1];

  // Extract the first entry from the block (quoted or unquoted)
  const entries = extractBlockEntries(sourceBlock);

  if (entries.length === 0) {
    return null;
  }

  let sourceUrl = entries[0];

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
  const sourceBlockRegex = regEx(/^source(?:_[^=]+)?=\(([\s\S]*?)\)/m);
  const blockMatch = sourceBlockRegex.exec(content);

  if (!blockMatch) {
    return sources;
  }

  const sourceBlock = blockMatch[1];

  // Extract individual entries from the block
  const entries = extractBlockEntries(sourceBlock);

  for (const url of entries) {
    sources.push({
      url,
      usesPkgver:
        url.includes('$' + '{pkgver}') ||
        url.includes('$pkgver') ||
        url.includes('$' + '{_pkgver}') ||
        url.includes('$_pkgver'),
    });
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
  const checksumBlockRegex = regEx(
    `^${type}sums(?:_[^=]+)?=\\(([\\s\\S]*?)\\)`,
    'm',
  );
  const match = checksumBlockRegex.exec(content);

  if (!match) {
    return null;
  }

  const checksumBlock = match[1];

  // Extract individual checksums (hex values or SKIP)
  const checksums = extractBlockEntries(checksumBlock);

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
  const filenameRegex = regEx(
    /^(.+?)-(v?[\d.]+[^-]*)\.(tar\.gz|tar\.bz2|tar\.xz|zip|tgz)$/,
  );
  const match = filenameRegex.exec(filename);

  if (match) {
    return match[1];
  }

  // Try simpler pattern without version
  const simpleRegex = regEx(/^(.+)\.(tar\.gz|tar\.bz2|tar\.xz|zip|tgz)$/);
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

  // Check for explicit custom configuration first (highest priority)
  const customConfig = extractCustomConfig(content);
  let sourceData: SourceData | null = null;

  if (customConfig) {
    logger.debug(
      `Using custom config: datasource=${customConfig.datasource} depName=${customConfig.depName}`,
    );
    sourceData = {
      url: sourceUrl,
      version: pkgver,
      datasource: customConfig.datasource,
      packageName: customConfig.depName,
    };
  }

  // Parse URL to detect datasource (if no custom config)
  sourceData ??= parseSourceUrl(sourceUrl, pkgver);

  // If no datasource detected, try Repology as fallback
  if (!sourceData) {
    // Check for manual Repology configuration first (legacy format)
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

  // Apply additional properties from custom config (extractVersion, versioning, etc.)
  if (customConfig?.additionalProps) {
    const props = customConfig.additionalProps;
    if (props.extractVersion) {
      dep.extractVersion = props.extractVersion;
    }
    if (props.versioning) {
      dep.versioning = props.versioning;
    }
    if (props.registryUrl) {
      dep.registryUrls = [props.registryUrl];
    }
  }

  return { deps: [dep] };
}
