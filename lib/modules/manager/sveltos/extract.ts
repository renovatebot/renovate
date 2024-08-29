import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { trimTrailingSlash } from '../../../util/url';
import { parseYaml } from '../../../util/yaml';
import { DockerDatasource } from '../../datasource/docker';
import { HelmDatasource } from '../../datasource/helm';
import { getDep } from '../dockerfile/extract';
import { isOCIRegistry, removeOCIPrefix } from '../helmv3/oci';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { ProfileDefinition, type SveltosHelmSource } from './schema';
import { removeRepositoryName } from './util';

export function extractPackageFile(
  content: string,
  packageFile: string,
  config?: ExtractConfig,
): PackageFileContent | null {
  let definitions: ProfileDefinition[];
  try {
    definitions = parseYaml(content, {
      customSchema: ProfileDefinition,
    });
  } catch (err) {
    logger.debug({ err, packageFile }, 'Failed to parse Sveltos definition.');
    return null;
  }

  const deps = definitions.flatMap((definition) =>
    extractDefinition(definition, config),
  );

  return deps.length ? { deps } : null;
}

function extractDefinition(
  definition: ProfileDefinition,
  config?: ExtractConfig,
): PackageDependency[] {
  const result = ProfileDefinition.safeParse(definition);
  if (result.success) {
    return processAppSpec(result.data, config);
  }
  return [];
}

function processHelmCharts(
  source: SveltosHelmSource,
  registryAliases: Record<string, string> | undefined,
): PackageDependency | null {
  const dep: PackageDependency = {
    depName: source.chartName,
    currentValue: source.chartVersion,
    datasource: HelmDatasource.id,
  };

  if (
    isOCIRegistry(source.repositoryURL) ||
    !source.repositoryURL.includes('://')
  ) {
    const image = trimTrailingSlash(removeOCIPrefix(source.repositoryURL));

    dep.datasource = DockerDatasource.id;
    dep.packageName = getDep(image, false, registryAliases).depName;
  } else {
    dep.packageName = removeRepositoryName(
      source.repositoryName,
      source.chartName,
    );
    dep.registryUrls = [source.repositoryURL];
    dep.datasource = HelmDatasource.id;
  }

  return dep;
}

function processAppSpec(
  definition: ProfileDefinition,
  config?: ExtractConfig,
): PackageDependency[] {
  const spec = definition.spec;

  const deps: PackageDependency[] = [];

  const depType = definition.kind;

  if (is.nonEmptyArray(spec.helmCharts)) {
    for (const source of coerceArray(spec.helmCharts)) {
      const dep = processHelmCharts(source, config?.registryAliases);
      if (dep) {
        dep.depType = depType;
        deps.push(dep);
      }
    }
  }

  return deps;
}
