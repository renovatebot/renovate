import { logger } from '../../../logger';
import { Result } from '../../../util/result';
import type { UpdateLockedConfig, UpdateLockedResult } from '../types';
import { Lockfile } from './schema';

export function updateLockedDependency(
  config: UpdateLockedConfig
): UpdateLockedResult {
  const { depName, currentVersion, newVersion, lockFile, lockFileContent } =
    config;
  logger.debug(
    `poetry.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`
  );

  const LockedVersionSchema = Lockfile.transform(({ lock }) => lock[depName]);
  return Result.parse(LockedVersionSchema, lockFileContent)
    .transform(
      (lockedVersion): Result<UpdateLockedResult, 'not-implemented'> =>
        lockedVersion === newVersion
          ? Result.ok({ status: 'already-updated' })
          : Result.err('not-implemented')
    )
    .unwrap({ status: 'unsupported' });
}
