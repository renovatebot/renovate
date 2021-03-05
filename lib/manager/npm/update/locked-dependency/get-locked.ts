import { logger } from '../../../../logger';
import type { PackageLockDependency, PackageLockOrEntry } from './types';

// Finds matching dependencies withing a package lock file of sub-entry
export function getLockedDependencies(
  entry: PackageLockOrEntry,
  depName: string,
  currentVersion: string
): PackageLockDependency[] {
  let res: PackageLockDependency[] = [];
  try {
    const { dependencies } = entry;
    if (!dependencies) {
      return [];
    }
    if (dependencies[depName]?.version === currentVersion) {
      res.push(dependencies[depName]);
    }
    for (const dependency of Object.values(dependencies)) {
      res = res.concat(
        getLockedDependencies(dependency, depName, currentVersion)
      );
    }
  } catch (err) {
    logger.warn({ err }, 'getLockedDependencies() error');
  }
  return res;
}
