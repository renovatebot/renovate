import { logger } from '../../../logger';
import { api as composer } from '../../versioning/composer';
import type { UpdateLockedConfig, UpdateLockedResult } from '../types';
import type { ComposerLock } from './types';

export function updateLockedDependency(
  config: UpdateLockedConfig
): UpdateLockedResult {
  const { depName, currentVersion, newVersion, lockFile, lockFileContent } =
    config;
  logger.debug(
    `composer.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`
  );
  try {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const locked = JSON.parse(lockFileContent!) as ComposerLock;
    if (
      locked.packages?.find(
        (entry) =>
          entry.name === depName &&
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
          composer.equals(entry.version || '', newVersion!)
      )
    ) {
      return { status: 'already-updated' };
    }
    return { status: 'unsupported' };
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, 'composer.updateLockedDependency() error');
    return { status: 'update-failed' };
  }
}
