import { logger } from '../../../../logger/index.ts';
import { coerceString } from '../../../../util/string.ts';
import type { UpdateLockedConfig, UpdateLockedResult } from '../../types.ts';
import { extractLocks } from './util.ts';

export function updateLockedDependency(
  config: UpdateLockedConfig,
): UpdateLockedResult {
  const { depName, currentVersion, newVersion, lockFile, lockFileContent } =
    config;
  // TODO: fix types (#22198)
  logger.debug(
    `terraform.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`,
  );
  try {
    const locked = extractLocks(coerceString(lockFileContent));
    const lockedDep = locked?.find(
      (dep) => dep.packageName === coerceString(depName),
    );
    if (lockedDep?.version === newVersion) {
      return { status: 'already-updated' };
    }
    return { status: 'unsupported' };
  } catch (err) {
    logger.debug({ err }, 'terraform.updateLockedDependency() error');
    return { status: 'update-failed' };
  }
}
