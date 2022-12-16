import { load } from 'js-yaml';
import { logger } from '../../../logger';
import type { PackageDependency, PackageFile } from '../types';

/**
 * Recursively find all supported dependencies in the yaml object.
 *
 * @param parsedContent
 */
function findDependencies(parsedContent: any): Array<PackageDependency> {
  if (!parsedContent || typeof parsedContent !== 'object') {
    return [];
  }

  Object.entries(parsedContent).forEach(([key, value]) => {
    logger.warn({ key, value }, 'Debug logging');
  });
  return [];
}

export function extractPackageFile(content: string): PackageFile | null {
  let parsedContent: any; // TODO typings
  try {
    // TODO: fix me (#9610)
    parsedContent = load(content, { json: true }) as any;
  } catch (err) {
    logger.debug({ err }, 'Failed to parse vendir YAML');
    return null;
  }
  try {
    const deps = findDependencies(parsedContent);
    if (deps.length) {
      return { deps };
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error parsing vendir parsed content');
  }
  return null;
}
