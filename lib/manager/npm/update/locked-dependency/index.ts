import { logger } from '../../../../logger';
import * as semver from '../../../../versioning/semver';
import type { UpdateLockedConfig, UpdateLockedResult } from '../../../types';
import * as packageLock from './package-lock';

export async function updateLockedDependency(
  config: UpdateLockedConfig
): Promise<UpdateLockedResult> {
  const { currentVersion, newVersion, lockFile } = config;
  if (!(semver.isVersion(currentVersion) && semver.isVersion(newVersion))) {
    logger.warn({ config }, 'Update versions are not valid');
    return { status: 'update-failed' };
  }
  if (lockFile.endsWith('package-lock.json')) {
    const res = await packageLock.updateLockedDependency(config);
    return res;
  }
  logger.debug({ lockFile }, 'Unsupported lock file');
  return { status: 'update-failed' };
}
