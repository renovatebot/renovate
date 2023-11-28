import { logger } from '../../../logger';
import type { UpdateLockedConfig, UpdateLockedResult } from '../types';
import { extractLockFileContentVersions } from './locked-version';

export function updateLockedDependency(
  config: UpdateLockedConfig,
): UpdateLockedResult {
  const { depName, currentVersion, newVersion, lockFile, lockFileContent } =
    config;
  logger.debug(
    `cargo.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`,
  );
  try {
    const locked = extractLockFileContentVersions(lockFileContent!);
    if (locked?.get(depName)?.find((version) => version === newVersion)) {
      return { status: 'already-updated' };
    }
    return { status: 'unsupported' };
  } catch (err) {
    logger.debug({ err }, 'cargo.updateLockedDependency() error');
    return { status: 'update-failed' };
  }
}
