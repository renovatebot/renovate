import semver from 'semver';
import { logger } from '../../../../logger';
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
    const lockFiles: string[] = [];
    if (yarnLock) {
      logger.trace('Found yarnLock');
      lockFiles.push(yarnLock);
      if (!lockFileCache[yarnLock]) {
        logger.trace('Retrieving/parsing ' + yarnLock);
        lockFileCache[yarnLock] = await getYarnLock(yarnLock);
      }
      const { lockfileVersion, isYarn1 } = lockFileCache[yarnLock];
      if (!isYarn1) {
        if (lockfileVersion && lockfileVersion >= 8) {
          // https://github.com/yarnpkg/berry/commit/9bcd27ae34aee77a567dd104947407532fa179b3
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
          packageFile.constraints!.yarn ??= '^3.0.0';
        } else if (lockfileVersion && lockfileVersion >= 6) {
          // https://github.com/yarnpkg/berry/commit/f753790380cbda5b55d028ea84b199445129f9ba
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
          packageFile.constraints!.yarn ??= '^2.2.0';
        } else {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
          packageFile.constraints!.yarn ??= '^2.0.0';
        }
      }
      for (const dep of packageFile.deps) {
        dep.lockedVersion =
          lockFileCache[yarnLock].lockedVersions[
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
    } else if (npmLock) {
      logger.debug('Found ' + npmLock + ' for ' + packageFile.packageFile);
      lockFiles.push(npmLock);
      if (!lockFileCache[npmLock]) {
        logger.trace('Retrieving/parsing ' + npmLock);
        lockFileCache[npmLock] = await getNpmLock(npmLock);
      }
      const { lockfileVersion } = lockFileCache[npmLock];
      if (lockfileVersion === 1) {
        if (packageFile.constraints?.npm) {
          // Add a <7 constraint if it's not already a fixed version
          if (!semver.valid(packageFile.constraints.npm)) {
            packageFile.constraints.npm += ' <7';
          }
        } else {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
          packageFile.constraints!.npm = '<7';
        }
      }
      for (const dep of packageFile.deps) {
        dep.lockedVersion = semver.valid(
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
          lockFileCache[npmLock].lockedVersions[dep.depName!]
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
