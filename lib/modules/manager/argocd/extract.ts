import is from '@sindresorhus/is';
import { loadAll } from 'js-yaml';
import { id } from '../../datasource/docker';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { HelmDatasource } from '../../datasource/helm';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import type { ApplicationDefinition } from './types';
import { fileTestRegex } from './util';

function createDependency(
  definition: ApplicationDefinition
): PackageDependency {
  const source = definition?.spec?.source;

  if (
    !source ||
    !is.nonEmptyString(source.repoURL) ||
    !is.nonEmptyString(source.targetRevision)
  ) {
    return null;
  }

  // a chart variable is defined this is helm declaration
  if (source.chart) {
    if (source.repoURL.includes('://')) {
      return {
        depName: source.chart,
        registryUrls: [source.repoURL],
        currentValue: source.targetRevision,
        datasource: HelmDatasource.id,
      };
    } else {
      return {
        depName: source.chart,
        registryUrls: [source.repoURL],
        currentValue: source.targetRevision,
        datasource: id,
      };
    }
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
  config?: ExtractConfig
): PackageFile | null {
  // check for argo reference. API version for the kind attribute is used
  if (fileTestRegex.test(content) === false) {
    return null;
  }

  const definitions = loadAll(content) as ApplicationDefinition[];

  const deps = definitions
    .map((definition) => createDependency(definition))
    .filter(Boolean);

  return deps.length ? { deps } : null;
}
