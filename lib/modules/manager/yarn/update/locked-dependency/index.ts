import { logger } from '../../../../../logger';
import semver from '../../../../versioning/semver';
import type { UpdateLockedConfig, UpdateLockedResult } from '../../../types';
import * as yarnLock from './yarn-lock';

export function updateLockedDependency(
  config: UpdateLockedConfig
): UpdateLockedResult {
  const { currentVersion, newVersion, lockFile } = config;
  if (!(semver.isVersion(currentVersion) && semver.isVersion(newVersion))) {
    logger.warn({ config }, 'Update versions are not valid');
    return { status: 'update-failed' };
  }
  if (lockFile.endsWith('yarn.lock')) {
    return yarnLock.updateLockedDependency(config);
  }
  logger.debug(`Unsupported lock file: ${lockFile}`);
  return { status: 'update-failed' };
}
