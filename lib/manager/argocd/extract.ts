import * as gitTags from '../../datasource/git-tags';
import * as helm from '../../datasource/helm';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import { fileTestRegex, keyValueExtractionRegex } from './util';

function createDependency(
  attributes: Record<string, string>
): PackageDependency {
  let result: PackageDependency;

  if (attributes.repoURL == null || attributes.targetRevision == null) {
    return null;
  }

  // a chart variable is defined this is helm declaration
  if (attributes.chart) {
    result = {
      depName: attributes.chart,
      registryUrls: [attributes.repoURL],
      currentValue: attributes.targetRevision,
      datasource: helm.id,
    };
  } else {
    result = {
      depName: attributes.repoURL,
      currentValue: attributes.targetRevision,
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
    if (fileTestRegex.test(content) === false) {
      return null;
    }

    const lines = definitionString.split('\n');

    const attributes: Record<string, string> = {};
    lines.forEach((line) => {
      const regexResult = keyValueExtractionRegex.exec(line);
      if (regexResult) {
        attributes[regexResult.groups.key] = regexResult.groups.value;
      }
    });

    return createDependency(attributes);
  });

  const filteredDeps = deps.filter((value) => value);

  if (filteredDeps.length === 0) {
    return null;
  }

  return { deps: filteredDeps };
}
