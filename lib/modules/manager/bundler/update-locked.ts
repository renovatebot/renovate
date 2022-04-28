import { logger } from '../../../logger';
import type { UpdateLockedConfig, UpdateLockedResult } from '../types';
import { extractLockFileEntries } from './locked-version';

// TODO: fix coverage after strict null checks finished

export function updateLockedDependency(
  config: UpdateLockedConfig
): UpdateLockedResult {
  const { depName, currentVersion, newVersion, lockFile, lockFileContent } =
    config;
  logger.debug(
    `bundler.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`
  );
  try {
    const locked = extractLockFileEntries(
      lockFileContent ?? /* istanbul ignore next: should never happen */ ''
    );
    if (
      locked.get(
        depName ?? /* istanbul ignore next: should never happen */ ''
      ) === newVersion
    ) {
      return { status: 'already-updated' };
    }
    return { status: 'unsupported' };
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, 'bundler.updateLockedDependency() error');
    return { status: 'update-failed' };
  }
}
