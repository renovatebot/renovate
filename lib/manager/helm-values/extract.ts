import yaml from 'js-yaml';
import { logger } from '../../logger';
import { getDep } from '../dockerfile/extract';

import { PackageFile, PackageDependency } from '../common';

/**
 * Recursively find all container image dependencies in the yaml content
 *
 * @param parsedContent
 */
function findImageDependencies(
  parsedContent: object,
  packageDependencies: Array<PackageDependency>
): Array<PackageDependency> {
  if (parsedContent && typeof parsedContent === 'object') {
    Object.keys(parsedContent).forEach(key => {
      if (parsedContent[key] && typeof parsedContent[key] === 'object') {
        if (key === 'image') {
          const currentItem = parsedContent[key];
          // TODO ensure we can really put together a correct FROM string here, include registry if present
          packageDependencies.push(
            getDep(`${currentItem.repository}:${currentItem.tag}`)
          );
        } else {
          findImageDependencies(parsedContent[key], packageDependencies);
        }
      }
    });
  }
  return packageDependencies;
}

export function extractPackageFile(content: string): PackageFile {
  const parsedContent = yaml.safeLoad(content);

  logger.info(
    { parsedContent },
    'Trying to find Docker dependencies in helm-values'
  );
  const deps = findImageDependencies(parsedContent, []);

  if (!deps.length) {
    return null;
  }

  return {
    deps,
  };
}
