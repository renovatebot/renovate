import is from '@sindresorhus/is';
import semver from 'semver';
import { dirname, relative } from 'upath';
import { logger } from '../../../../logger';
import type { PackageFile } from '../../types';
import type { NpmManagerData } from '../types';
import { getPnpmLock } from './pnpm';
import type { LockFile } from './types';

export async function getLockedVersions(
  packageFiles: PackageFile<NpmManagerData>[]
): Promise<void> {
  const lockFileCache: Record<string, LockFile> = {};
  logger.debug('Finding locked versions');
  for (const packageFile of packageFiles) {
    const { managerData = {} } = packageFile;
    const { pnpmShrinkwrap } = managerData;
    const lockFiles: string[] = [];
    if (pnpmShrinkwrap) {
      logger.debug('Found pnpm lock-file');
      lockFiles.push(pnpmShrinkwrap);
      if (!lockFileCache[pnpmShrinkwrap]) {
        logger.trace(`Retrieving/parsing ${pnpmShrinkwrap}`);
        lockFileCache[pnpmShrinkwrap] = await getPnpmLock(pnpmShrinkwrap);
      }

      const packageDir = dirname(packageFile.packageFile);
      const pnpmRootDir = dirname(pnpmShrinkwrap);
      const relativeDir = relative(pnpmRootDir, packageDir) || '.';

      for (const dep of packageFile.deps) {
        const { depName, depType } = dep;
        // TODO: types (#22198)
        const lockedVersion = semver.valid(
          lockFileCache[pnpmShrinkwrap].lockedVersionsWithPath?.[relativeDir]?.[
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
