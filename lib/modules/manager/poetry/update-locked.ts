import { logger } from '../../../logger';
import type { UpdateLockedConfig, UpdateLockedResult } from '../types';
import { extractLockFileEntries } from './locked-version';

export function updateLockedDependency(
  config: UpdateLockedConfig
): UpdateLockedResult {
  const { depName, currentVersion, newVersion, lockFile, lockFileContent } =
    config;
  logger.debug(
    // TODO: types (#7154)
    `poetry.updateLockedDependency: ${depName}@${currentVersion!} -> ${newVersion} [${lockFile}]`
  );
  const locked = extractLockFileEntries(lockFileContent ?? '');
  if (depName && locked[depName] === newVersion) {
    return { status: 'already-updated' };
  }
  return { status: 'unsupported' };
}
