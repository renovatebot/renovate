import { logger } from '../../../logger/index.ts';
import type { UpdateLockedConfig, UpdateLockedResult } from '../types.ts';
import * as lockfile from './lockfile.ts';
import { MiseLockFile } from './schema.ts';

export function updateLockedDependency(
  config: UpdateLockedConfig,
): UpdateLockedResult {
  const { depName, newVersion, lockFile, lockFileContent } = config;
  logger.debug(
    `mise.updateLockedDependency: ${depName} -> ${newVersion} [${lockFile}]`,
  );

  if (!depName || !lockFileContent) {
    return { status: 'unsupported' };
  }

  try {
    const parsed = MiseLockFile.safeParse(lockFileContent);
    if (!parsed.success) {
      return { status: 'unsupported' };
    }

    if (lockfile.getLockedVersion(parsed.data, depName) === newVersion) {
      return { status: 'already-updated' };
    }

    return { status: 'unsupported' };
  } catch (err) {
    logger.debug({ err }, 'mise.updateLockedDependency() error');
    return { status: 'update-failed' };
  }
}
