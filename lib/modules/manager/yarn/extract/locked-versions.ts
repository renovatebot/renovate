import { logger } from '../../../../logger';
import type { PackageFile } from '../../types';
import type { NpmManagerData } from '../types';
import type { LockFile } from './types';
import { getYarnLock, getYarnVersionFromLock } from './yarn';

export async function getLockedVersions(
  packageFiles: PackageFile<NpmManagerData>[]
): Promise<void> {
  const lockFileCache: Record<string, LockFile> = {};
  logger.debug('Finding locked versions');
  for (const packageFile of packageFiles) {
    const { managerData = {} } = packageFile;
    const { yarnLock } = managerData;
    const lockFiles: string[] = [];
    if (yarnLock) {
      logger.trace('Found yarnLock');
      lockFiles.push(yarnLock);
      if (!lockFileCache[yarnLock]) {
        logger.trace(`Retrieving/parsing ${yarnLock}`);
        lockFileCache[yarnLock] = await getYarnLock(yarnLock);
      }
      const { isYarn1 } = lockFileCache[yarnLock];
      let yarn: string | undefined;
      if (!isYarn1 && !packageFile.extractedConstraints?.yarn) {
        yarn = getYarnVersionFromLock(lockFileCache[yarnLock]);
      }
      if (yarn) {
        packageFile.extractedConstraints ??= {};
        packageFile.extractedConstraints.yarn = yarn;
      }
      for (const dep of packageFile.deps) {
        dep.lockedVersion =
          lockFileCache[yarnLock].lockedVersions?.[
            // TODO: types (#22198)
            `${dep.depName}@${dep.currentValue}`
          ];
        if (
          (dep.depType === 'engines' || dep.depType === 'packageManager') &&
          dep.depName === 'yarn' &&
          !isYarn1
        ) {
          dep.packageName = '@yarnpkg/cli';
        }
      }
    }
    if (lockFiles.length) {
      packageFile.lockFiles = lockFiles;
    }
  }
}
