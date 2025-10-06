import { logger } from '../../../logger';
import { getHttpUrl } from '../../../util/git/url';
import { findLocalSiblingOrParent, readLocalFile } from '../../../util/fs';
import { parseSingleYaml } from '../../../util/yaml';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { HelmDatasource } from '../../datasource/helm';
import { getDep } from '../dockerfile/extract';
import { isOCIRegistry, removeOCIPrefix } from '../helmv3/oci';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import type {
  GitRefDefinition,
  GithubReleaseDefinition,
  HelmChartDefinition,
  VendirDefinition,
  VendirLockDefinition,
} from './schema';
import { Vendir, VendirLock } from './schema';

export function extractHelmChart(
  helmChart: HelmChartDefinition,
  aliases?: Record<string, string>,
): PackageDependency | null {
  if (isOCIRegistry(helmChart.repository.url)) {
    const dep = getDep(
      `${removeOCIPrefix(helmChart.repository.url)}/${helmChart.name}:${helmChart.version}`,
      false,
      aliases,
    );
    return {
      ...dep,
      depName: helmChart.name,
      depType: 'HelmChart',
      // https://github.com/helm/helm/issues/10312
      // https://github.com/helm/helm/issues/10678
      pinDigests: false,
    };
  }
  return {
    depName: helmChart.name,
    currentValue: helmChart.version,
    depType: 'HelmChart',
    registryUrls: [helmChart.repository.url],
    datasource: HelmDatasource.id,
  };
}

export function extractGitSource(
  gitSource: GitRefDefinition,
): PackageDependency | null {
  const httpUrl = getHttpUrl(gitSource.url);
  return {
    depName: httpUrl,
    packageName: httpUrl,
    depType: 'GitSource',
    currentValue: gitSource.ref,
    registryUrls: [httpUrl],
    datasource: GitRefsDatasource.id,
  };
}

export function extractGithubReleaseSource(
  githubRelease: GithubReleaseDefinition,
): PackageDependency | null {
  return {
    depName: githubRelease.slug,
    packageName: githubRelease.slug,
    depType: 'GithubRelease',
    currentValue: githubRelease.tag,
    datasource: GithubReleasesDatasource.id,
  };
}

export function parseVendir(
  content: string,
  packageFile?: string,
): VendirDefinition | null {
  try {
    return parseSingleYaml(content, {
      customSchema: Vendir,
      removeTemplates: true,
    });
  } catch {
    logger.debug({ packageFile }, 'Error parsing vendir.yml file');
    return null;
  }
}

export function parseVendirLock(
  content: string,
  lockFile?: string,
): VendirLockDefinition | null {
  try {
    return parseSingleYaml(content, {
      customSchema: VendirLock,
      removeTemplates: true,
    });
  } catch {
    logger.debug({ lockFile }, 'Error parsing vendir.lock.yml file');
    return null;
  }
}

export async function readVendirLock(
  packageFile: string,
): Promise<VendirLockDefinition | null> {
  const lockFileName = await findLocalSiblingOrParent(
    packageFile,
    'vendir.lock.yml',
  );
  if (!lockFileName) {
    logger.debug(
      { packageFile },
      'No vendir.lock.yml found for vendir.yml file',
    );
    return null;
  }

  const lockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!lockFileContent) {
    logger.debug({ lockFileName }, 'Empty vendir.lock.yml file');
    return null;
  }

  return parseVendirLock(lockFileContent, lockFileName);
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): Promise<PackageFileContent | null> {
  logger.trace(`vendir.extractPackageFile(${packageFile})`);
  const deps: PackageDependency[] = [];

  const pkg = parseVendir(content, packageFile);
  if (!pkg) {
    return null;
  }

  // Read lockfile to get locked versions
  const lockFile = await readVendirLock(packageFile);
  const lockMap = new Map<string, any>();

  if (lockFile) {
    // Build a map of directory.path -> content.path -> locked data
    for (const directory of lockFile.directories) {
      for (const lockedContent of directory.contents) {
        const key = `${directory.path}:${lockedContent.path}`;
        lockMap.set(key, lockedContent);
      }
    }
  }

  // Extract dependencies from manifest
  for (const directory of pkg.directories) {
    for (const content of directory.contents) {
      const lockKey = `${directory.path}:${content.path}`;
      const lockedContent = lockMap.get(lockKey);

      if ('helmChart' in content && content.helmChart) {
        const dep = extractHelmChart(content.helmChart, config.registryAliases);
        if (dep && lockedContent && 'helmChart' in lockedContent) {
          dep.lockedVersion = lockedContent.helmChart.version;
        }
        if (dep) {
          deps.push(dep);
        }
      } else if ('git' in content && content.git) {
        const dep = extractGitSource(content.git);
        if (dep && lockedContent && 'git' in lockedContent) {
          dep.lockedVersion = lockedContent.git.sha;
        }
        if (dep) {
          deps.push(dep);
        }
      } else if ('githubRelease' in content && content.githubRelease) {
        const dep = extractGithubReleaseSource(content.githubRelease);
        if (dep && lockedContent && 'githubRelease' in lockedContent) {
          dep.lockedVersion = lockedContent.githubRelease.tag ?? lockedContent.githubRelease.url;
        }
        if (dep) {
          deps.push(dep);
        }
      }
    }
  }

  if (!deps.length) {
    return null;
  }

  const result: PackageFileContent = { deps };
  if (lockFile) {
    result.lockFiles = ['vendir.lock.yml'];
  }

  return result;
}
