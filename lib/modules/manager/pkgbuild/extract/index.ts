import { logger } from '../../../../logger/index.ts';
import { detectPlatform } from '../../../../util/common.ts';
import { regEx } from '../../../../util/regex.ts';
import { RepologyDatasource } from '../../../datasource/repology/index.ts';
import type { PackageDependency, PackageFileContent } from '../../types.ts';
import type { SourceData } from '../types.ts';
import { parseCPANUrl } from './cpan.ts';
import { parseForgejoUrl } from './forgejo.ts';
import { parseGenericGitUrl } from './generic-git.ts';
import { parseGiteaUrl } from './gitea.ts';
import { parseGitHubUrl } from './github.ts';
import { parseGitLabUrl } from './gitlab.ts';
import { parseNpmUrl } from './npm.ts';
import { parsePackagistUrl } from './packagist.ts';
import { parsePyPIUrl } from './pypi.ts';
import {
  extractChecksums,
  extractMultiSourceData,
  extractPackageNameFromFilename,
  extractPkgname,
  extractPkgver,
  extractSource,
  extractVariables,
} from './utils.ts';

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
    const { hostname } = parsedUrl;

    // Use detectPlatform for git forges (GitHub, GitLab, Gitea, Forgejo/Codeberg)
    const platform = detectPlatform(expandedUrl);
    switch (platform) {
      case 'github':
        return parseGitHubUrl(parsedUrl, expandedUrl);
      case 'gitlab':
        return parseGitLabUrl(parsedUrl, expandedUrl);
      case 'gitea': {
        const result = parseGiteaUrl(parsedUrl, expandedUrl);
        if (result) {
          return result;
        }
        break;
      }
      case 'forgejo': {
        const result = parseForgejoUrl(parsedUrl, expandedUrl);
        if (result) {
          return result;
        }
        break;
      }
    }

    // PyPI detection
    if (
      hostname === 'files.pythonhosted.org' ||
      hostname === 'pypi.org' ||
      hostname === 'pypi.python.org'
    ) {
      return parsePyPIUrl(parsedUrl, expandedUrl);
    }

    // npm detection
    if (
      hostname === 'registry.npmjs.org' ||
      hostname === 'registry.npmjs.com'
    ) {
      return parseNpmUrl(parsedUrl, expandedUrl);
    }

    // CPAN detection
    if (hostname === 'cpan.metacpan.org' || hostname.includes('cpan')) {
      return parseCPANUrl(parsedUrl, expandedUrl);
    }

    // Packagist detection
    if (hostname.includes('packagist')) {
      return parsePackagistUrl(parsedUrl, expandedUrl);
    }

    // Generic Git repository (archive URL or .git URL)
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

  let sourceData: SourceData | null = parseSourceUrl(sourceUrl, pkgver);

  if (!sourceData) {
    const pkgname = extractPkgname(content);
    if (pkgname) {
      logger.debug(
        `Using Repology datasource as fallback for package: ${pkgname}`,
      );
      sourceData = {
        url: sourceUrl,
        version: pkgver,
        datasource: RepologyDatasource.id,
        packageName: `aur/${pkgname}`,
      };
    } else {
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

  if (!sourceData) {
    logger.debug('Unable to parse source URL or unsupported source');
    return null;
  }

  const checksums = extractChecksums(content);
  if (Object.keys(checksums).length === 0) {
    logger.debug('No checksums found in PKGBUILD');
  }

  // Find all underscore-prefixed variables whose value matches pkgver
  // These are version aliases (e.g., _pkgver, _basever) that need updating
  const vars = extractVariables(content);
  const versionVariables: string[] = [];
  for (const [name, value] of vars) {
    if (name.startsWith('_') && value === pkgver) {
      versionVariables.push(name);
    }
  }
  if (versionVariables.length > 0) {
    logger.debug({ versionVariables }, 'Found version-aliasing variables');
  }

  const multiSourceData = extractMultiSourceData(content, versionVariables);
  logger.debug({ multiSourceData }, 'Extracted multi-source data');

  const dep: PackageDependency = {
    depName: sourceData.packageName ?? `${sourceData.owner}/${sourceData.repo}`,
    currentValue: sourceData.version,
    datasource: sourceData.datasource,
    managerData: {
      sourceUrl,
      checksums,
      pkgver,
      versionVariables,
      multiSource: multiSourceData,
    },
  };

  if (sourceData.registryUrl) {
    dep.registryUrls = [sourceData.registryUrl];
  }

  return { deps: [dep] };
}
