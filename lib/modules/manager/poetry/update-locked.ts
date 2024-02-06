import { logger } from '../../../logger';
import { Result } from '../../../util/result';
import type { UpdateLockedConfig, UpdateLockedResult } from '../types';
import { Lockfile } from './schema';

export function updateLockedDependency(
  config: UpdateLockedConfig,
): UpdateLockedResult {
  const { depName, currentVersion, newVersion, lockFile, lockFileContent } =
    config;
  logger.debug(
    `poetry.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`,
  );

  const LockedVersionSchema = Lockfile.transform(({ lock }) => lock[depName]);
  return Result.parse(lockFileContent, LockedVersionSchema)
    .transform(
      (lockedVersion): UpdateLockedResult =>
        lockedVersion === newVersion
          ? { status: 'already-updated' }
          : { status: 'unsupported' },
    )
    .unwrapOrElse({ status: 'unsupported' });
}
