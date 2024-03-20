import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { parseSingleYaml } from '../../../util/yaml';
import { HelmDatasource } from '../../datasource/helm';
import { getDep } from '../dockerfile/extract';
import { isOCIRegistry, resolveAlias } from '../helmv3/utils';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { HelmChartDefinition, Vendir, VendirDefinition } from './schema';

import { isHelmChart } from './utils';

// TODO: Add support for other vendir types (like git tags, github releases, etc.)
// Recommend looking at the kustomize manager for more information on support.

export function extractHelmChart(
  helmChart: HelmChartDefinition,
  aliases?: Record<string, string> | undefined,
): PackageDependency | null {
  if (isOCIRegistry(helmChart.repository.url)) {
    const dep = getDep(
      `${helmChart.repository.url.replace('oci://', '')}/${helmChart.name}:${helmChart.version}`,
      false,
      aliases,
    );
    return {
      ...dep,
      depName: helmChart.name,
      packageName: dep.depName,
      // https://github.com/helm/helm/issues/10312
      // https://github.com/helm/helm/issues/10678
      pinDigests: false,
    };
  }
  let repository = helmChart.repository.url || null;
  if (aliases) {
    repository = resolveAlias(helmChart.repository.url, aliases);
  }
  if (!repository) {
    return {
      depName: helmChart.name,
      currentValue: helmChart.version,
      datasource: HelmDatasource.id,
      skipReason: 'placeholder-url',
    };
  }
  return {
    depName: helmChart.name,
    currentValue: helmChart.version,
    registryUrls: [repository],
    datasource: HelmDatasource.id,
  };
}

export function parseVendir(
  content: string,
  packageFile?: string,
): VendirDefinition | null {
  let pkg: VendirDefinition;
  try {
    pkg = parseSingleYaml(content, {
      customSchema: Vendir,
      removeTemplates: true,
    });
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
    if (isHelmChart(content)) {
      const dep = extractHelmChart(content.helmChart, config.registryAliases);
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
