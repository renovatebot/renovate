import { logger } from '../../../logger/index.ts';
import { getHttpUrl } from '../../../util/git/url.ts';
import { parseSingleYaml } from '../../../util/yaml.ts';
import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { HelmDatasource } from '../../datasource/helm/index.ts';
import { getDep } from '../dockerfile/extract.ts';
import { isOCIRegistry, removeOCIPrefix } from '../helmv3/oci.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';
import type {
  GitRefDefinition,
  GithubReleaseDefinition,
  HelmChartDefinition,
  VendirDefinition,
} from './schema.ts';
import { Vendir } from './schema.ts';

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
    depType: 'GitSource',
    currentValue: gitSource.ref,
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

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): PackageFileContent | null {
  logger.trace(`vendir.extractPackageFile(${packageFile})`);
  const deps: PackageDependency[] = [];

  const pkg = parseVendir(content, packageFile);
  if (!pkg) {
    return null;
  }

  // grab the helm charts
  const contents = pkg.directories.flatMap((directory) => directory.contents);
  for (const content of contents) {
    if ('helmChart' in content && content.helmChart) {
      const dep = extractHelmChart(content.helmChart, config.registryAliases);
      if (dep) {
        deps.push(dep);
      }
    } else if ('git' in content && content.git) {
      const dep = extractGitSource(content.git);
      if (dep) {
        deps.push(dep);
      }
    } else if ('githubRelease' in content && content.githubRelease) {
      const dep = extractGithubReleaseSource(content.githubRelease);
      if (dep) {
        deps.push(dep);
      }
    }
  }

  if (!deps.length) {
    return null;
  }
  return { deps };
}
