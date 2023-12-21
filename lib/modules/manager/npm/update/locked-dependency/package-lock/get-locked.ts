import { logger } from '../../../../../../logger';
import type { PackageLockDependency, PackageLockOrEntry } from './types';

// Finds matching dependencies withing a package lock file of sub-entry
export function getLockedDependencies(
  entry: PackageLockOrEntry,
  depName: string,
  currentVersion: string | null,
  bundled = false,
): PackageLockDependency[] {
  let res: PackageLockDependency[] = [];
  try {
    const { dependencies } = entry;
    if (!dependencies) {
      return [];
    }
    const dep = dependencies[depName];
    if (dep && (currentVersion === null || dep?.version === currentVersion)) {
      if (bundled || entry.bundled) {
        dep.bundled = true;
      }
      res.push(dep);
    }
    for (const dependency of Object.values(dependencies)) {
      res = res.concat(
        getLockedDependencies(
          dependency,
          depName,
          currentVersion,
          bundled || !!entry.bundled,
        ),
      );
    }
  } catch (err) {
    logger.warn({ err }, 'getLockedDependencies() error');
  }
  return res;
}
