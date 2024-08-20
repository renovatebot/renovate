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
import {
  ProfileDefinition,
  type SveltosHelmSource,
  type SveltosHelmSpec,
} from './schema';
import { fileTestRegex, removeRepositoryName } from './util';

export function extractPackageFile(
  content: string,
  packageFile: string,
  _config?: ExtractConfig,
): PackageFileContent | null {
  // check for svelteos reference. API version for the kind attribute is used
  if (fileTestRegex.test(content) === false) {
    logger.debug(
      `Skip file ${packageFile} as no projectsveltos.io apiVersion could be found in matched file`,
    );
    return null;
  }

  let definitions: ProfileDefinition[];
  try {
    definitions = parseYaml(content, null, {
      customSchema: ProfileDefinition,
      failureBehaviour: 'filter',
      removeTemplates: true,
    });
  } catch (err) {
    logger.debug({ err, packageFile }, 'Failed to parse Sveltos definition.');
    return null;
  }

  const deps = definitions.flatMap(processAppSpec);

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
