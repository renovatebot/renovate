import yaml from 'js-yaml';
import { logger } from '../../logger';
import { getDep } from '../dockerfile/extract';

import { PackageFile, PackageDependency } from '../common';
import { matchesHelmValuesDockerHeuristic } from './util';

/**
 * Recursively find all supported dependencies in the yaml object.
 *
 * @param parsedContent
 */
function findDependencies(
  parsedContent: object,
  packageDependencies: Array<PackageDependency>
): Array<PackageDependency> {
  if (!parsedContent || typeof parsedContent !== 'object') {
    return packageDependencies;
  }

  Object.keys(parsedContent).forEach(key => {
    if (matchesHelmValuesDockerHeuristic(key, parsedContent[key])) {
      const currentItem = parsedContent[key];
      // TODO include registry if present
      packageDependencies.push(
        getDep(`${currentItem.repository}:${currentItem.tag}`)
      );
    } else {
      findDependencies(parsedContent[key], packageDependencies);
    }
  });
  return packageDependencies;
}

export function extractPackageFile(content: string): PackageFile {
  try {
    // a parser that allows extracting line numbers would be preferable, with
    // the current approach we need to match anything we find again during the update
    const parsedContent = yaml.safeLoad(content);

    logger.debug(
      { parsedContent },
      'Trying to find dependencies in helm-values'
    );
    const deps = findDependencies(parsedContent, []);

    if (deps.length) {
      logger.debug({ deps }, 'Found dependencies in helm-values');
      return { deps };
    }
  } catch (err) {
    logger.error({ err }, 'Failed to parse helm-values file');
  }

  return null;
}
