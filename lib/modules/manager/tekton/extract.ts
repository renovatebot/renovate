import is from '@sindresorhus/is';
import { loadAll } from 'js-yaml';
import { logger } from '../../../logger';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(
  content: string,
  fileName: string
): PackageFile | null {
  logger.trace('tekton.extractPackageFile()');
  const deps: PackageDependency[] = [];
  let docs: any[];
  try {
    docs = loadAll(content) as any[];
  } catch (err) {
    logger.debug(
      { err, fileName },
      'Failed to parse YAML resource to find tekton references'
    );
    return null;
  }
  for (const doc of docs) {
    deps.push(...getDeps(doc));
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}

function getDeps(doc: any): PackageDependency[] {
  const deps = [];
  for (const key in doc) {
    const value = doc[key];
    if (key === 'bundle' && is.string(value) && !is.emptyString(value)) {
      const dep = createDep(value);
      logger.trace(
        {
          depName: dep.depName,
          currentValue: dep.currentValue,
          currentDigest: dep.currentDigest,
        },
        'Tekton bundle dependency found in .bundle reference'
      );
      deps.push(dep);
    } else if (
      key === 'name' &&
      value === 'bundle' &&
      is.string(doc['value']) &&
      !is.emptyString(doc['value'])
    ) {
      const dep = createDep(doc['value']);
      logger.trace(
        {
          depName: dep.depName,
          currentValue: dep.currentValue,
          currentDigest: dep.currentDigest,
        },
        'Tekton bundle dependency found in .value reference'
      );
      deps.push(dep);
    } else if (is.array(value)) {
      for (const val of value) {
        deps.push(...getDeps(val));
      }
    } else if (is.object(value)) {
      deps.push(...getDeps(value));
    }
  }
  return deps;
}

function createDep(imageRef: string): PackageDependency {
  const dep = getDep(imageRef);
  // If a tag is not found, assume the lowest possible version. This will
  // ensure the version update is successful, and properly pin the digest.
  dep.currentValue = dep.currentValue ?? '0.0';
  dep.depType = 'tekton-bundle';
  return dep;
}
