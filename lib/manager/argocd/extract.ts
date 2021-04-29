import { safeLoadAll } from 'js-yaml';
import * as gitTags from '../../datasource/git-tags';
import * as helm from '../../datasource/helm';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import type { ApplicationDefinition } from './types';
import { fileTestRegex } from './util';

function createDependency(
  definition: ApplicationDefinition
): PackageDependency {
  const source = definition.spec?.source;

  if (source == null) {
    return null;
  }

  // a chart variable is defined this is helm declaration
  if (source.chart) {
    return {
      depName: source.chart,
      registryUrls: [source.repoURL],
      currentValue: source.targetRevision,
      datasource: helm.id,
    };
  }
  return {
    depName: source.repoURL,
    currentValue: source.targetRevision,
    datasource: gitTags.id,
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

  const definitions: ApplicationDefinition[] = safeLoadAll(content);

  const deps = definitions
    .map((definition) => createDependency(definition))
    .filter(Boolean);

  return deps.length ? { deps } : null;
}
