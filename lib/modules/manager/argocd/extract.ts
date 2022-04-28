import is from '@sindresorhus/is';
import { loadAll } from 'js-yaml';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { HelmDatasource } from '../../datasource/helm';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
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
  _fileName: string,
  _config?: ExtractConfig
): PackageFile | null {
  // check for argo reference. API version for the kind attribute is used
  if (fileTestRegex.test(content) === false) {
    return null;
  }

  const definitions = loadAll(content) as ApplicationDefinition[];

  const deps = definitions
    .map((definition) => createDependency(definition))
    .filter(is.truthy);

  return deps.length ? { deps } : null;
}
