import { logger } from '../../../../logger';
import type { UpdateLockedConfig, UpdateLockedResult } from '../../types';
import { extractLocks } from './util';

export function updateLockedDependency(
  config: UpdateLockedConfig
): UpdateLockedResult {
  const { depName, currentVersion, newVersion, lockFile, lockFileContent } =
    config;
  // TODO: fix types (#7154)
  logger.debug(
    `terraform.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`
  );
  try {
    const locked = extractLocks(lockFileContent ?? '');
    const lockedDep = locked?.find((dep) => dep.packageName === depName ?? '');
    if (lockedDep?.version === newVersion) {
      return { status: 'already-updated' };
    }
    return { status: 'unsupported' };
  } catch (err) {
    logger.debug({ err }, 'terraform.updateLockedDependency() error');
    return { status: 'update-failed' };
  }
}
