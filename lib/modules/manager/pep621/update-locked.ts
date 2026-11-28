import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import { Result } from '../../../util/result.ts';
import { normalizePythonDepName } from '../../datasource/pypi/common.ts';
import type { UpdateLockedConfig, UpdateLockedResult } from '../types.ts';
import { UvLockfile } from './schema.ts';

/**
 * Returns `already-updated` when `uv.lock` locks the dependency once, at
 * `newVersion`, and `unsupported` otherwise.
 */
export function updateLockedDependency(
  config: UpdateLockedConfig,
): UpdateLockedResult {
  const { depName, currentVersion, newVersion, lockFile, lockFileContent } =
    config;
  logger.debug(
    `pep621.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`,
  );

  if (upath.basename(lockFile) !== 'uv.lock') {
    return { status: 'unsupported' };
  }

  const packageName = normalizePythonDepName(depName);
  const LockedPackage = UvLockfile.transform(
    ({ packages }) => packages[packageName],
  );
  return Result.parse(lockFileContent, LockedPackage)
    .transform((locked): UpdateLockedResult =>
      locked?.version === newVersion && !locked.hasMultipleEntries
        ? { status: 'already-updated' }
        : { status: 'unsupported' },
    )
    .unwrapOr({ status: 'unsupported' });
}
