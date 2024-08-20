import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { trimTrailingSlash } from '../../../util/url';
import { parseYaml } from '../../../util/yaml';
import { DockerDatasource } from '../../datasource/docker';
import { HelmDatasource } from '../../datasource/helm';
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
  _config?: ExtractConfig,
): PackageFileContent | null {
  let definitions: Record<string, unknown>[] | ProfileDefinition[];
  try {
    definitions = parseYaml<any>(content, null, {
      customSchema: ProfileDefinition,
    });
  } catch (err) {
    logger.debug({ err, packageFile }, 'Failed to parse Sveltos definition.');
    return null;
  }

  const deps = definitions.flatMap((definition) => {
    // Use zod's safeParse method to check if the object matches the ProfileDefinition schema
    const result = ProfileDefinition.safeParse(definition);
    if (result.success) {
      return processAppSpec(result.data);
    }
    return [];
  });

  //onst deps = definitions.flatMap(processAppSpec);

  return deps.length ? { deps } : null;
}

function processHelmCharts(
  source: SveltosHelmSource,
): PackageDependency | null {
  const dep: PackageDependency = {
    currentValue: source.chartVersion,
    datasource: HelmDatasource.id,
  };

  if (
    isOCIRegistry(source.repositoryURL) ||
    !source.repositoryURL.includes('://')
  ) {
    const registryURL = trimTrailingSlash(
      removeOCIPrefix(source.repositoryURL),
    );

    dep.depName = `${registryURL}`;
    dep.datasource = DockerDatasource.id;
  } else {
    dep.depName = removeRepositoryName(source.repositoryName, source.chartName);
    dep.registryUrls = [source.repositoryURL];
    dep.datasource = HelmDatasource.id;
  }

  return dep;
}

function processAppSpec(definition: ProfileDefinition): PackageDependency[] {
  const spec = definition.spec;

  const deps: PackageDependency[] = [];

  const depType = definition.kind;

  if (is.nonEmptyArray(spec.helmCharts)) {
    for (const source of coerceArray(spec.helmCharts)) {
      const dep = processHelmCharts(source);
      if (dep) {
        dep.depType = depType;
        deps.push(dep);
      }
    }
  }

  return deps;
}
