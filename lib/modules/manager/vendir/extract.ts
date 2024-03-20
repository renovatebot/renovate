import { logger } from '../../../logger';
import { parseSingleYaml } from '../../../util/yaml';
import { HelmDatasource } from '../../datasource/helm';
import { getDep } from '../dockerfile/extract';
import { isOCIRegistry } from '../helmv3/utils';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { HelmChartDefinition, Vendir, VendirDefinition } from './schema';

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
): VendirDefinition | null {
  try {
    return parseSingleYaml(content, {
      customSchema: Vendir,
      removeTemplates: true,
    });
  } catch (e) {
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
    const dep = extractHelmChart(content.helmChart, config.registryAliases);
    if (dep) {
      deps.push({
        ...dep,
        depType: 'HelmChart',
      });
    }
  }

  if (!deps.length) {
    return null;
  }
  return { deps };
}
