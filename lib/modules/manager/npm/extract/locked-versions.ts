import semver from 'semver';
import { logger } from '../../../../logger';
import type { PackageFile } from '../../types';
import type { NpmManagerData } from '../types';
import { getNpmLock } from './npm';
import { getPnpmShrinkwrap } from './pnpm';
import type { LockFile } from './types';
import { getYarnLock } from './yarn';

export async function getLockedVersions(
  packageFiles: PackageFile<NpmManagerData>[]
): Promise<void> {
  const lockFileCache: Record<string, LockFile> = {};
  logger.debug('Finding locked versions');
  for (const packageFile of packageFiles) {
    const { managerData = {} } = packageFile;
    const { yarnLock, npmLock, pnpmShrinkwrap } = managerData;
    const lockFiles: string[] = [];
    if (yarnLock) {
      logger.trace('Found yarnLock');
      lockFiles.push(yarnLock);
      if (!lockFileCache[yarnLock]) {
        logger.trace('Retrieving/parsing ' + yarnLock);
        lockFileCache[yarnLock] = await getYarnLock(yarnLock);
      }
      const { lockfileVersion, isYarn1 } = lockFileCache[yarnLock];
      if (!isYarn1 && !packageFile.extractedConstraints?.yarn) {
        if (lockfileVersion && lockfileVersion >= 8) {
          // https://github.com/yarnpkg/berry/commit/9bcd27ae34aee77a567dd104947407532fa179b3
          packageFile.extractedConstraints!.yarn = '^3.0.0';
        } else if (lockfileVersion && lockfileVersion >= 6) {
          // https://github.com/yarnpkg/berry/commit/f753790380cbda5b55d028ea84b199445129f9ba
          packageFile.extractedConstraints!.yarn = '^2.2.0';
        } else {
          packageFile.extractedConstraints!.yarn = '^2.0.0';
        }
      }
      for (const dep of packageFile.deps) {
        dep.lockedVersion =
          lockFileCache[yarnLock].lockedVersions[
            // TODO: types (#7154)
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
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
      logger.debug(`Found ${npmLock} for ${packageFile.packageFile}`);
      lockFiles.push(npmLock);
      if (!lockFileCache[npmLock]) {
        logger.trace('Retrieving/parsing ' + npmLock);
        lockFileCache[npmLock] = await getNpmLock(npmLock);
      }
      const { lockfileVersion } = lockFileCache[npmLock];
      if (lockfileVersion === 1) {
        if (packageFile.extractedConstraints?.npm) {
          // Add a <7 constraint if it's not already a fixed version
          if (
            semver.satisfies('6.14.18', packageFile.extractedConstraints.npm)
          ) {
            packageFile.extractedConstraints.npm += ' <7';
          }
        } else {
          packageFile.extractedConstraints!.npm = '<7';
        }
      } else if (lockfileVersion === 2) {
        if (packageFile.extractedConstraints?.npm) {
          // Add a <9 constraint if the latest 8.x is compatible
          if (
            semver.satisfies('8.19.3', packageFile.extractedConstraints.npm)
          ) {
            packageFile.extractedConstraints.npm += ' <9';
          }
        } else {
          packageFile.extractedConstraints!.npm = '<9';
        }
      }
      for (const dep of packageFile.deps) {
        // TODO: types (#7154)
        dep.lockedVersion = semver.valid(
          lockFileCache[npmLock].lockedVersions[dep.depName!]
        )!;
      }
    } else if (pnpmShrinkwrap) {
      logger.debug('Found pnpm lock-file');
      lockFiles.push(pnpmShrinkwrap);
      if (!lockFileCache[pnpmShrinkwrap]) {
        logger.trace('Retrieving/parsing ' + pnpmShrinkwrap);
        lockFileCache[pnpmShrinkwrap] = await getPnpmShrinkwrap(pnpmShrinkwrap);
      }
      const { lockfileVersion } = lockFileCache[pnpmShrinkwrap];

      // pnpm-version to pnpm lock-file version relation: https://github.com/pnpm/spec/tree/master/lockfile
      if (lockfileVersion === 6) {
        if (packageFile.extractedConstraints?.pnpm) {
          //  if the latest 7.x release is compatible we need to increase the constraint
          if (
            semver.satisfies('7.32.0', packageFile.extractedConstraints.pnpm)
          ) {
            packageFile.extractedConstraints.pnpm += ' >=8';
          }
        } else {
          packageFile.extractedConstraints!.pnpm = '>=8';
        }
      } else {
        if (packageFile.extractedConstraints?.pnpm) {
          // TODO: implement constraints for pnpm 5 🙂
          // wondering if that will need to be done separately for 5.0, 5.1, 5.2, 5.3, 5.4
        } else {
          packageFile.extractedConstraints!.pnpm = '>=3.0.0, <8.0.0'; // HELP NEEDED: is this correct way to add range constraints
        }
      }

      for (const dep of packageFile.deps) {
        // TODO: types (#7154)
        dep.lockedVersion = semver.valid(
          lockFileCache[pnpmShrinkwrap].lockedVersions[dep.depName!]
        )!;
      }
    }
    if (lockFiles.length) {
      packageFile.lockFiles = lockFiles;
    }
  }
}
