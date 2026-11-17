import upath from 'upath';
import { logger } from '../../../../logger/index.ts';
import { coerceArray } from '../../../../util/array.ts';
import { minimatch } from '../../../../util/minimatch.ts';
import type { PackageFile } from '../../types.ts';
import type { NpmManagerData } from '../types.ts';
import type { LockFilePackageFiles } from './types.ts';

export function matchesAnyPattern(val: string, patterns: string[]): boolean {
  const res = patterns.some(
    (pattern) =>
      pattern === `${val}/` || minimatch(pattern, { dot: true }).match(val),
  );
  logger.trace({ val, patterns, res }, `matchesAnyPattern`);
  return res;
}

/**
 * Groups `packageFiles` by the lock file in `managerData[lockFileKey]`, with the root `package.json` of each lock file.
 */
export function groupByLockFile<T extends Partial<PackageFile<NpmManagerData>>>(
  packageFiles: T[],
  lockFileKey: 'pnpmLockFile' | 'yarnLock',
): LockFilePackageFiles<T>[] {
  const groups = new Map<string, T[]>();
  for (const packageFile of packageFiles) {
    const lockFile = packageFile.managerData?.[lockFileKey];
    if (lockFile) {
      const group = coerceArray(groups.get(lockFile));
      group.push(packageFile);
      groups.set(lockFile, group);
    }
  }
  return [...groups].map(([lockFile, lockFilePackageFiles]) => {
    const rootPackageFile = upath.join(upath.dirname(lockFile), 'package.json');
    const root =
      lockFilePackageFiles.find(
        (packageFile) => packageFile.packageFile === rootPackageFile,
      ) ??
      lockFilePackageFiles.find((packageFile) =>
        packageFile.packageFile?.endsWith('package.json'),
      );
    return { lockFile, packageFiles: lockFilePackageFiles, root };
  });
}
