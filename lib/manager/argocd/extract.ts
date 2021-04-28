import { safeLoad } from 'js-yaml';
import * as gitTags from '../../datasource/git-tags';
import * as helm from '../../datasource/helm';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import type { ApplicationDefinition } from './types';
import { fileTestRegex } from './util';

function loadYaml(content: string): ApplicationDefinition {
  const config = safeLoad(content);

  if (typeof config !== 'object') {
    /* istanbul ignore next */
    throw new Error(
      `Configuration file does not contain a YAML object (it is ${typeof config}).`
    );
  }

  return config as ApplicationDefinition;
}
function createDependency(
  definition: ApplicationDefinition
): PackageDependency {
  let result: PackageDependency;

  const source = definition.spec.source;

  if (source == null) {
    return null;
  }

  // a chart variable is defined this is helm declaration
  if (source.chart) {
    result = {
      depName: source.chart,
      registryUrls: [source.repoURL],
      currentValue: source.targetRevision,
      datasource: helm.id,
    };
  } else {
    result = {
      depName: source.repoURL,
      currentValue: source.targetRevision,
      datasource: gitTags.id,
    };
  }
  return result;
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

  const definitionStrings = content.split('---');

  const deps = definitionStrings.map((definitionString) => {
    // check if the block is an ArgoCD API object
    if (fileTestRegex.test(definitionString) === false) {
      return null;
    }

    const definition = loadYaml(definitionString);

    return createDependency(definition);
  });

  const filteredDeps = deps.filter((value) => value);

  if (filteredDeps.length === 0) {
    return null;
  }

  return { deps: filteredDeps };
}
