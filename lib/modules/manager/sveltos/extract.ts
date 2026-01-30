import { coerceArray } from '../../../util/array.ts';
import { trimTrailingSlash } from '../../../util/url.ts';
import { parseYaml } from '../../../util/yaml.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { HelmDatasource } from '../../datasource/helm/index.ts';
import { getDep } from '../dockerfile/extract.ts';
import { isOCIRegistry, removeOCIPrefix } from '../helmv3/oci.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';
import { ProfileDefinition, type SveltosHelmSource } from './schema.ts';
import { removeRepositoryName } from './util.ts';

export function extractPackageFile(
  content: string,
  packageFile: string,
  config?: ExtractConfig,
): PackageFileContent | null {
  const definitions = parseYaml(content, {
    customSchema: ProfileDefinition,
    failureBehaviour: 'filter',
  });

  const deps: PackageDependency[] = [];

  for (const definition of definitions) {
    const extractedDeps = extractDefinition(definition, config);
    deps.push(...extractedDeps);
  }

  return deps.length ? { deps } : null;
}

export function extractDefinition(
  definition: ProfileDefinition,
  config?: ExtractConfig,
): PackageDependency[] {
  return processAppSpec(definition, config);
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

  if (isOCIRegistry(source.repositoryURL)) {
    const image = trimTrailingSlash(removeOCIPrefix(source.repositoryURL));

    dep.datasource = DockerDatasource.id;
    dep.packageName = getDep(image, false, registryAliases).packageName;
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
  const deps: PackageDependency[] = [];

  const depType = definition.kind;

  for (const source of coerceArray(definition.spec?.helmCharts)) {
    const dep = processHelmCharts(source, config?.registryAliases);
    if (dep) {
      dep.depType = depType;
      deps.push(dep);
    }
  }

  return deps;
}
