import { logger } from '../../../logger';
import { extractPackageFile as extractRequirementsFile } from '../pip_requirements/extract';
import type { UpdateLockedConfig, UpdateLockedResult } from '../types';

export function updateLockedDependency(
  config: UpdateLockedConfig,
): UpdateLockedResult {
  const { depName, currentVersion, newVersion, lockFile, lockFileContent } =
    config;
  logger.debug(
    `pip-compile.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`,
  );
  try {
    // lock files are always of "requirements.txt" type
    const locked = extractRequirementsFile(lockFileContent ?? '');
    if (locked === null) {
      throw Error('is null');
    }
    if (
      locked.deps &&
      locked.deps.find((d) => d.depName ?? '' === depName)?.currentVersion ===
        newVersion
    ) {
      return { status: 'already-updated' };
    }
    // exec pip-compile --upgrade-package ${depName}==${newVersion}
    // return { status: 'updated', files: { [lockFile]: newLockFileContent } }
    logger.debug({ depName }, 'TRIED UPDATING LOCKED DEP'); // TODO
    return { status: 'unsupported' };
  } catch (err) {
    logger.debug({ err }, 'bundler.updateLockedDependency() error');
    return { status: 'update-failed' };
  }
}
