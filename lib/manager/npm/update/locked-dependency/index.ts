import { logger } from '../../../../logger';
import * as semver from '../../../../versioning/semver';
import { UpdateLockedConfig } from '../../../types';
import * as packageLock from './package-lock';

export function updateLockedDependency(
  config: UpdateLockedConfig
): Promise<Record<string, string>> {
  const { currentVersion, newVersion, lockFile } = config;
  if (!(semver.isVersion(currentVersion) && semver.isVersion(newVersion))) {
    logger.warn({ config }, 'Update versions are not valid');
    return null;
  }
  if (lockFile.endsWith('package-lock.json')) {
    return packageLock.updateLockedDependency(config);
  }
  logger.debug({ lockFile }, 'Unsupported lock file');
  return null;
}
