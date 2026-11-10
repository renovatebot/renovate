import { logger } from '../../../logger/index.ts';
import type { UpdateLockedConfig, UpdateLockedResult } from '../types.ts';
import { extractLockFileEntries } from './locked-version.ts';

export function updateLockedDependency(
  config: UpdateLockedConfig,
): UpdateLockedResult {
  const { depName, currentVersion, newVersion, lockFile, lockFileContent } =
    config;
  logger.debug(
    `bundler.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`,
  );
  try {
    const locked = extractLockFileEntries(lockFileContent ?? '');
    if (locked.get(depName ?? '') === newVersion) {
      return { status: 'already-updated' };
    }
    return { status: 'unsupported' };
  } catch (err) {
    logger.debug({ err }, 'bundler.updateLockedDependency() error');
    return { status: 'update-failed' };
  }
}
