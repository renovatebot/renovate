import is from '@sindresorhus/is';
import semver from 'semver';
import { logger } from '../../../../logger';
import type { PackageFile } from '../../types';
import type { NpmManagerData } from '../types';
import { getNpmLock } from './npm';
import { getPnpmLock } from './pnpm';
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
        logger.trace(`Retrieving/parsing ${yarnLock}`);
        lockFileCache[yarnLock] = await getYarnLock(yarnLock);
      }
      const { lockfileVersion, isYarn1 } = lockFileCache[yarnLock];
      let yarn: string | undefined;
      if (!isYarn1 && !packageFile.extractedConstraints?.yarn) {
        if (lockfileVersion && lockfileVersion >= 8) {
          // https://github.com/yarnpkg/berry/commit/9bcd27ae34aee77a567dd104947407532fa179b3
          yarn = '^3.0.0';
        } else if (lockfileVersion && lockfileVersion >= 6) {
          // https://github.com/yarnpkg/berry/commit/f753790380cbda5b55d028ea84b199445129f9ba
          yarn = '^2.2.0';
        } else {
          yarn = '^2.0.0';
        }
      }
      if (yarn) {
        packageFile.extractedConstraints ??= {};
        packageFile.extractedConstraints.yarn = yarn;
      }
      for (const dep of packageFile.deps) {
        dep.lockedVersion =
          lockFileCache[yarnLock].lockedVersions?.[
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
        const cache = await getNpmLock(npmLock);
        // istanbul ignore if
        if (!cache) {
          logger.warn({ npmLock }, 'Npm: unable to get lockfile');
          return;
        }
        lockFileCache[npmLock] = cache;
      }

      const { lockfileVersion } = lockFileCache[npmLock];
      let npm: string | undefined;
      if (lockfileVersion === 1) {
        if (packageFile.extractedConstraints?.npm) {
          // Add a <7 constraint if it's not already a fixed version
          if (
            semver.satisfies('6.14.18', packageFile.extractedConstraints.npm)
          ) {
            npm = packageFile.extractedConstraints.npm + ' <7';
          }
        } else {
          npm = '<7';
        }
      } else if (lockfileVersion === 2) {
        if (packageFile.extractedConstraints?.npm) {
          // Add a <9 constraint if the latest 8.x is compatible
          if (
            semver.satisfies('8.19.3', packageFile.extractedConstraints.npm)
          ) {
            npm = packageFile.extractedConstraints.npm + ' <9';
          }
        } else {
          npm = '<9';
        }
      } else if (lockfileVersion === 3) {
        if (!packageFile.extractedConstraints?.npm) {
          npm = '>=7';
        }
      } else {
        logger.warn(
          { lockfileVersion, npmLock },
          'Found unsupported npm lockfile version'
        );
        return;
      }
      if (npm) {
        packageFile.extractedConstraints ??= {};
        packageFile.extractedConstraints.npm = npm;
      }

      for (const dep of packageFile.deps) {
        // TODO: types (#7154)
        dep.lockedVersion = semver.valid(
          lockFileCache[npmLock].lockedVersions?.[dep.depName!]
        )!;
      }
    } else if (pnpmShrinkwrap) {
      logger.debug('Found pnpm lock-file');
      lockFiles.push(pnpmShrinkwrap);
      if (!lockFileCache[pnpmShrinkwrap]) {
        logger.trace(`Retrieving/parsing ${pnpmShrinkwrap}`);
        lockFileCache[pnpmShrinkwrap] = await getPnpmLock(pnpmShrinkwrap);
      }

      const parentDir = packageFile.packageFile
        .replace(/\/package\.json$/, '')
        .replace(/^package\.json$/, '.');
      for (const dep of packageFile.deps) {
        const { depName, depType } = dep;
        // TODO: types (#7154)
        const lockedVersion = semver.valid(
          lockFileCache[pnpmShrinkwrap].lockedVersionsWithPath?.[parentDir]?.[
            depType!
          ]?.[depName!]
        );
        if (is.string(lockedVersion)) {
          dep.lockedVersion = lockedVersion;
        }
      }
    }
    if (lockFiles.length) {
      packageFile.lockFiles = lockFiles;
    }
  }
}
