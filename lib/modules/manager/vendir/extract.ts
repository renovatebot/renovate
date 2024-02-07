import is from '@sindresorhus/is';
import { parseSingleYaml } from '../../../util/yaml';
import { logger } from '../../../logger';
import { HelmDatasource } from '../../datasource/helm';
import type { PackageDependency, PackageFileContent } from '../types';
import type { HelmChart, Vendir } from './types';
import { isHelmChart } from './utils';

// TODO: Add support for other vendir types (like git tags, github releases, etc.)
// Recommend looking at the kustomize manager for more information on support.

export function extractHelmChart(
  helmChart: HelmChart,
): PackageDependency | null {
  if (!helmChart.name) {
    return null;
  }

  return {
    depName: helmChart.name,
    currentValue: helmChart.version,
    registryUrls: [helmChart.repository.url],
    datasource: HelmDatasource.id,
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

  pkg.kind ??= 'Config';

  if (!['Config'].includes(pkg.kind)) {
    return null;
  }

  return pkg;
}

export function extractPackageFile(
  content: string,
  packageFile?: string, // TODO: fix tests
): PackageFileContent | null {
  logger.trace(`vendir.extractPackageFile(${packageFile!})`);
  const deps: PackageDependency[] = [];

  const pkg = parseVendir(content, packageFile);
  if (!pkg) {
    return null;
  }

  // grab the helm charts
  // TODO: Add support for OCI Repos by translating Registry URLs and using
  // Docker datasource. (See Helmv3 for example implementation)
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
