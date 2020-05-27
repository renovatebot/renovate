import { valid } from 'semver';
import { logger } from '../../../logger';
import { PackageFile } from '../../common';
import { getNpmLock } from './npm';
import { getYarnLock } from './yarn';

export async function getLockedVersions(
  packageFiles: PackageFile[]
): Promise<void> {
  const lockFileCache: Record<string, Record<string, string>> = {};
  logger.debug('Finding locked versions');
  for (const packageFile of packageFiles) {
    const { yarnLock, npmLock, pnpmShrinkwrap } = packageFile;
    if (yarnLock) {
      logger.trace('Found yarnLock');
      if (!lockFileCache[yarnLock]) {
        logger.trace('Retrieving/parsing ' + yarnLock);
        lockFileCache[yarnLock] = await getYarnLock(yarnLock);
      }
      for (const dep of packageFile.deps) {
        dep.lockedVersion =
          lockFileCache[yarnLock][`${dep.depName}@${dep.currentValue}`];
      }
    } else if (npmLock) {
      logger.debug('Found ' + npmLock + ' for ' + packageFile.packageFile);
      if (!lockFileCache[npmLock]) {
        logger.trace('Retrieving/parsing ' + npmLock);
        lockFileCache[npmLock] = await getNpmLock(npmLock);
      }
      for (const dep of packageFile.deps) {
        dep.lockedVersion = valid(lockFileCache[npmLock][dep.depName]);
      }
    } else if (pnpmShrinkwrap) {
      logger.debug('TODO: implement pnpm-lock.yaml parsing of lockVersion');
    }
  }
}
