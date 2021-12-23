import { logger } from '../../logger';
import { api as composer } from '../../versioning/composer';
import { UpdateLockedConfig, UpdateLockedResult } from '../types';
import { ComposerLock } from './types';

export function updateLockedDependency(
  config: UpdateLockedConfig
): UpdateLockedResult {
  const { depName, currentVersion, newVersion, lockFile, lockFileContent } =
    config;
  logger.debug(
    `composer.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`
  );
  const locked = JSON.parse(lockFileContent) as ComposerLock;
  if (
    locked.packages?.find(
      (entry) =>
        entry.name === depName &&
        composer.equals(entry.version || '', newVersion)
    )
  ) {
    return { status: 'already-updated' };
  }
  return { status: 'unsupported' };
}
