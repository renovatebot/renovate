import { valid } from 'semver';
import { logger } from '../../../logger';
import type { PackageFile } from '../../types';
import { getNpmLock } from './npm';
import type { LockFile } from './types';
import { getYarnLock } from './yarn';

export async function getLockedVersions(
  packageFiles: PackageFile[]
): Promise<void> {
  const lockFileCache: Record<string, LockFile> = {};
  logger.debug('Finding locked versions');
  for (const packageFile of packageFiles) {
    const { yarnLock, npmLock, pnpmShrinkwrap } = packageFile;
    const lockFiles = [];
    if (yarnLock) {
      logger.trace('Found yarnLock');
      lockFiles.push(yarnLock);
      if (!lockFileCache[yarnLock]) {
        logger.trace('Retrieving/parsing ' + yarnLock);
        lockFileCache[yarnLock] = await getYarnLock(yarnLock);
      }
      const { lockfileVersion, isYarn1 } = lockFileCache[yarnLock];
      if (!isYarn1) {
        if (lockfileVersion >= 6) {
          // https://github.com/yarnpkg/berry/commit/f753790380cbda5b55d028ea84b199445129f9ba
          packageFile.constraints.yarn = '^2.2.0';
        } else {
          packageFile.constraints.yarn = '^2.0.0';
        }
      }
      for (const dep of packageFile.deps) {
        dep.lockedVersion =
          lockFileCache[yarnLock].lockedVersions[
            `${dep.depName}@${dep.currentValue}`
          ];
        if (dep.depType === 'engines' && dep.depName === 'yarn' && !isYarn1) {
          dep.lookupName = '@yarnpkg/cli';
        }
      }
    } else if (npmLock) {
      logger.debug('Found ' + npmLock + ' for ' + packageFile.packageFile);
      lockFiles.push(npmLock);
      if (!lockFileCache[npmLock]) {
        logger.trace('Retrieving/parsing ' + npmLock);
        lockFileCache[npmLock] = await getNpmLock(npmLock);
      }
      const { lockfileVersion } = lockFileCache[npmLock];
      if (lockfileVersion === 1) {
        if (packageFile.constraints.npm) {
          packageFile.constraints.npm += ' <7';
        } else {
          packageFile.constraints.npm = '<7';
        }
      }
      for (const dep of packageFile.deps) {
        dep.lockedVersion = valid(
          lockFileCache[npmLock].lockedVersions[dep.depName]
        );
      }
    } else if (pnpmShrinkwrap) {
      logger.debug('TODO: implement pnpm-lock.yaml parsing of lockVersion');
      lockFiles.push(pnpmShrinkwrap);
    }
    if (lockFiles.length) {
      packageFile.lockFiles = lockFiles;
    }
  }
}
