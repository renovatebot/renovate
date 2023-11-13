import is from '@sindresorhus/is';
import { loadAll } from 'js-yaml';
import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { trimTrailingSlash } from '../../../util/url';
import { DockerDatasource } from '../../datasource/docker';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { HelmDatasource } from '../../datasource/helm';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import type {
  ApplicationDefinition,
  ApplicationSource,
  ApplicationSpec,
} from './types';
import { fileTestRegex } from './util';

export function extractPackageFile(
  content: string,
  packageFile: string,
  _config?: ExtractConfig,
): PackageFileContent | null {
  // check for argo reference. API version for the kind attribute is used
  if (fileTestRegex.test(content) === false) {
    logger.debug(
      `Skip file ${packageFile} as no argoproj.io apiVersion could be found in matched file`,
    );
    return null;
  }

  let definitions: ApplicationDefinition[];
  try {
    definitions = loadAll(content) as ApplicationDefinition[];
  } catch (err) {
    logger.debug({ err, packageFile }, 'Failed to parse ArgoCD definition.');
    return null;
  }

  const deps = definitions.filter(is.plainObject).flatMap(processAppSpec);

  return deps.length ? { deps } : null;
}

function processSource(source: ApplicationSource): PackageDependency | null {
  if (
    !source ||
    !is.nonEmptyString(source.repoURL) ||
    !is.nonEmptyString(source.targetRevision)
  ) {
    return null;
  }

  // a chart variable is defined this is helm declaration
  if (source.chart) {
    // assume OCI helm chart if repoURL doesn't contain explicit protocol
    if (
      source.repoURL.startsWith('oci://') ||
      !source.repoURL.includes('://')
    ) {
      let registryURL = source.repoURL.replace('oci://', '');
      registryURL = trimTrailingSlash(registryURL);

      return {
        depName: `${registryURL}/${source.chart}`,
        currentValue: source.targetRevision,
        datasource: DockerDatasource.id,
      };
    }

    return {
      depName: source.chart,
      registryUrls: [source.repoURL],
      currentValue: source.targetRevision,
      datasource: HelmDatasource.id,
    };
  }

  return {
    depName: source.repoURL,
    currentValue: source.targetRevision,
    datasource: GitTagsDatasource.id,
  };
}

function processAppSpec(
  definition: ApplicationDefinition,
): PackageDependency[] {
  const spec: ApplicationSpec | null | undefined =
    definition.kind === 'Application'
      ? definition?.spec
      : definition?.spec?.template?.spec;

  if (is.nullOrUndefined(spec)) {
    return [];
  }

  const deps: (PackageDependency | null)[] = [];

  if (is.nonEmptyObject(spec.source)) {
    deps.push(processSource(spec.source));
  }

  for (const source of coerceArray(spec.sources)) {
    deps.push(processSource(source));
  }

  return deps.filter(is.truthy);
}
