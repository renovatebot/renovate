import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { parseSingleYaml } from '../../../util/yaml';
import { DockerDatasource } from '../../datasource/docker';
import { HelmDatasource } from '../../datasource/helm';
import type { PackageDependency, PackageFileContent } from '../types';
import type { HelmChart, Vendir } from './types';
import { isHelmChart, isOCIRegistry } from './utils';

// TODO: Add support for other vendir types (like git tags, github releases, etc.)
// Recommend looking at the kustomize manager for more information on support.

export function extractHelmChart(
  helmChart: HelmChart,
): PackageDependency | null {
  let registryUrl = helmChart.repository.url;
  let dataSource = HelmDatasource.id;
  if (isOCIRegistry(helmChart.repository)) {
    registryUrl = helmChart.repository.url.replace('oci://', 'https://');
    dataSource = DockerDatasource.id;
  }
  return {
    depName: helmChart.name,
    currentValue: helmChart.version,
    registryUrls: [registryUrl],
    datasource: dataSource,
  };
}

export function parseVendir(
  content: string,
  packageFile?: string,
): Vendir | null {
  let pkg: Vendir | null = null;
  try {
    pkg = parseSingleYaml(content);
  } catch (e) /* istanbul ignore next */ {
    logger.debug({ packageFile }, 'Error parsing vendir.yml file');
    return null;
  }

  if (!pkg || is.string(pkg)) {
    return null;
  }
  return pkg;
}

export function extractPackageFile(
  content: string,
  packageFile?: string,
): PackageFileContent | null {
  logger.trace(`vendir.extractPackageFile(${packageFile!})`);
  const deps: PackageDependency[] = [];

  const pkg = parseVendir(content, packageFile);
  if (!pkg) {
    return null;
  }

  // grab the helm charts
  const contents = pkg.directories.flatMap((directory) => directory.contents);
  for (const content of contents) {
    if (isHelmChart(content)) {
      const dep = extractHelmChart(content.helmChart);
      if (dep) {
        deps.push({
          ...dep,
          depType: 'HelmChart',
        });
      }
    }
  }

  if (!deps.length) {
    return null;
  }
  return { deps };
}
