import is from '@sindresorhus/is';
import { loadAll } from 'js-yaml';
import { logger } from '../../../logger';
import { trimTrailingSlash } from '../../../util/url';
import { DockerDatasource } from '../../datasource/docker';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { HelmDatasource } from '../../datasource/helm';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import type { ApplicationDefinition, ApplicationSource } from './types';
import { fileTestRegex } from './util';

function createDependency(
  definition: ApplicationDefinition
): PackageDependency | null {
  let source: ApplicationSource;
  switch (definition.kind) {
    case 'Application':
      source = definition?.spec?.source;
      break;
    case 'ApplicationSet':
      source = definition?.spec?.template?.spec?.source;
      break;
  }

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

export function extractPackageFile(
  content: string,
  fileName: string,
  _config?: ExtractConfig
): PackageFileContent | null {
  // check for argo reference. API version for the kind attribute is used
  if (fileTestRegex.test(content) === false) {
    return null;
  }

  let definitions: ApplicationDefinition[];
  try {
    definitions = loadAll(content) as ApplicationDefinition[];
  } catch (err) {
    logger.debug({ err, fileName }, 'Failed to parse ArgoCD definition.');
    return null;
  }

  const deps = definitions
    .filter(is.plainObject)
    .map((definition) => createDependency(definition))
    .filter(is.truthy);

  return deps.length ? { deps } : null;
}
