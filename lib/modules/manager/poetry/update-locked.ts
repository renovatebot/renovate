import { logger } from '../../../logger/index.ts';
import { Result } from '../../../util/result.ts';
import { nonNullish } from '../../../util/schema-utils/index.ts';
import type { UpdateLockedConfig, UpdateLockedResult } from '../types.ts';
import { Lockfile } from './schema.ts';

export function updateLockedDependency(
  config: UpdateLockedConfig,
): UpdateLockedResult {
  const { depName, currentVersion, newVersion, lockFile, lockFileContent } =
    config;
  logger.debug(
    `poetry.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`,
  );

  const LockedVersion = Lockfile.transform(
    ({ lock }) => lock[depName],
  ).transform(nonNullish);
  return Result.parse(lockFileContent, LockedVersion)
    .transform(
      (lockedVersion): UpdateLockedResult =>
        lockedVersion === newVersion
          ? { status: 'already-updated' }
          : { status: 'unsupported' },
    )
    .unwrapOr({ status: 'unsupported' });
}
