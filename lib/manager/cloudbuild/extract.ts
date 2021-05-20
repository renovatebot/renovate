import is from '@sindresorhus/is';
import yaml from 'js-yaml';
import { logger } from '../../logger';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile {
  const deps: PackageDependency[] = [];
  try {
    const doc = yaml.safeLoad(content) as any;
    if (doc?.steps && is.array(doc.steps)) {
      for (const step of doc.steps) {
        if (step.name) {
          const dep = getDep(step.name);
          logger.trace(
            {
              depName: dep.depName,
              currentValue: dep.currentValue,
              currentDigest: dep.currentDigest,
            },
            'Cloud Build docker image'
          );

          deps.push(dep);
        }
      }
    }
  } catch (err) /* istanbul ignore next */ {
    if (err.stack?.startsWith('YAMLException:')) {
      logger.debug(
        { err },
        'YAML exception extracting Docker images from a Cloud Build configuration file.'
      );
    } else {
      logger.warn(
        { err },
        'Error extracting Docker images from a Cloud Build configuration file.'
      );
    }
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
