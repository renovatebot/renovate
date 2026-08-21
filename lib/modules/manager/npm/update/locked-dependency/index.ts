import { logger } from '../../../../../logger/index.ts';
import semver from '../../../../versioning/semver/index.ts';
import type { UpdateLockedConfig, UpdateLockedResult } from '../../../types.ts';
import * as packageLock from './package-lock/index.ts';
import * as yarnLock from './yarn-lock/index.ts';

export async function updateLockedDependency(
  config: UpdateLockedConfig,
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
  if (lockFile.endsWith('yarn.lock')) {
    return yarnLock.updateLockedDependency(config);
  }
  if (lockFile.endsWith('pnpm-lock.yaml')) {
    logger.debug(
      'Cannot patch pnpm lock file directly - falling back to using pnpm',
    );
    return { status: 'unsupported' };
  }

  logger.debug(`updateLockedDependency(): unsupported lock file: ${lockFile}`);

  return { status: 'update-failed' };
}
