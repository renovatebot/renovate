import yaml from 'js-yaml';
import { logger } from '../../logger';
import { PackageDependency, PackageFile } from '../common';
import { getDep } from '../dockerfile/extract';

import {
  HelmDockerImageDependency,
  matchesHelmValuesDockerHeuristic,
} from './util';

/**
 * Recursively find all supported dependencies in the yaml object.
 *
 * @param parsedContent
 */
function findDependencies(
  parsedContent: object | HelmDockerImageDependency,
  packageDependencies: Array<PackageDependency>
): Array<PackageDependency> {
  if (!parsedContent || typeof parsedContent !== 'object') {
    return packageDependencies;
  }

  Object.keys(parsedContent).forEach((key) => {
    if (matchesHelmValuesDockerHeuristic(key, parsedContent[key])) {
      const currentItem = parsedContent[key];

      const registry = currentItem.registry ? `${currentItem.registry}/` : '';
      packageDependencies.push(
        getDep(`${registry}${currentItem.repository}:${currentItem.tag}`, false)
      );
    } else {
      findDependencies(parsedContent[key], packageDependencies);
    }
  });
  return packageDependencies;
}

export function extractPackageFile(content: string): PackageFile {
  let parsedContent;
  try {
    // a parser that allows extracting line numbers would be preferable, with
    // the current approach we need to match anything we find again during the update
    parsedContent = yaml.safeLoad(content, { json: true });
  } catch (err) {
    logger.debug({ err }, 'Failed to parse helm-values YAML');
    return null;
  }
  try {
    const deps = findDependencies(parsedContent, []);
    if (deps.length) {
      logger.debug({ deps }, 'Found dependencies in helm-values');
      return { deps };
    }
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, 'Error parsing helm-values parsed content');
  }
  return null;
}
