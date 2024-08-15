import { logger } from '../../../logger';
import type { UpdateLockedConfig, UpdateLockedResult } from '../types';
import { extractLockFileContentVersions } from './locked-version';

export function updateLockedDependency(
  config: UpdateLockedConfig,
): UpdateLockedResult {
  const { depName, currentVersion, newVersion, lockFile, lockFileContent } =
    config;
  logger.debug(
    `gleam.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`,
  );
  try {
    const locked = extractLockFileContentVersions(lockFileContent!);
    if (locked?.get(depName)?.find((version) => version === newVersion)) {
      return { status: 'already-updated' };
    }
    // we don't currently support directly updating the lock file
    // so we'll use gleam itself (via updateArtifacts()) to update the lock file instead
    return { status: 'unsupported' };
  } catch (err) {
    logger.debug({ err }, 'gleam.updateLockedDependency() error');
    return { status: 'update-failed' };
  }
}
