import { coerceArray } from '../../../util/array.ts';
import { parseYaml } from '../../../util/yaml.ts';
import { HelmDatasource } from '../../datasource/helm/index.ts';
import { getOciChartDep, isOCIRegistry } from '../helmv3/oci.ts';
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
): PackageDependency {
  const dep: PackageDependency = {
    depName: source.chartName,
    currentValue: source.chartVersion,
  };

  if (isOCIRegistry(source.repositoryURL)) {
    return {
      ...dep,
      ...getOciChartDep(
        source.repositoryURL,
        source.chartName,
        registryAliases,
      ),
    };
  }

  return {
    ...dep,
    packageName: removeRepositoryName(source.repositoryName, source.chartName),
    registryUrls: [source.repositoryURL],
    datasource: HelmDatasource.id,
  };
}

function processAppSpec(
  definition: ProfileDefinition,
  config?: ExtractConfig,
): PackageDependency[] {
  const deps: PackageDependency[] = [];

  const depType = definition.kind;

  const helmCharts =
    definition.kind === 'ClusterPromotion'
      ? definition.spec?.profileSpec?.helmCharts
      : definition.spec?.helmCharts;

  for (const source of coerceArray(helmCharts)) {
    const dep = processHelmCharts(source, config?.registryAliases);
    dep.depType = depType;
    deps.push(dep);
  }

  return deps;
}
