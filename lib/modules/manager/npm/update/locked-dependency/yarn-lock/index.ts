import { parseSyml } from '@yarnpkg/parsers';
import { logger } from '../../../../../../logger';
import { api as semver } from '../../../../../versioning/npm';
import type { UpdateLockedConfig, UpdateLockedResult } from '../../../../types';
import { getLockedDependencies } from './get-locked';
import { replaceConstraintVersion } from './replace';
import type { YarnLock, YarnLockEntryUpdate } from './types';

export function updateLockedDependency(
  config: UpdateLockedConfig,
): UpdateLockedResult {
  const { depName, currentVersion, newVersion, lockFile, lockFileContent } =
    config;
  logger.debug(
    `npm.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`,
  );
  let yarnLock: YarnLock;
  try {
    // TODO #22198
    yarnLock = parseSyml(lockFileContent!);
  } catch (err) {
    logger.warn({ err }, 'Failed to parse yarn files');
    return { status: 'update-failed' };
  }
  try {
    const lockedDeps = getLockedDependencies(yarnLock, depName, currentVersion);
    if (!lockedDeps.length) {
      const newLockedDeps = getLockedDependencies(
        yarnLock,
        depName,
        newVersion,
      );
      if (newLockedDeps.length) {
        logger.debug(
          `${depName}@${currentVersion} not found in ${lockFile} but ${depName}@${newVersion} was - looks like it's already updated`,
        );
        return { status: 'already-updated' };
      }
      logger.debug(
        `${depName}@${currentVersion} not found in ${lockFile} - cannot update`,
      );
      return { status: 'update-failed' };
    }
    if ('__metadata' in yarnLock) {
      logger.debug(
        'Cannot patch Yarn 2+ lock file directly - falling back to using yarn',
      );
      return { status: 'unsupported' };
    }
    logger.debug(
      `Found matching dependencies with length ${lockedDeps.length}`,
    );
    const updateLockedDeps: YarnLockEntryUpdate[] = [];
    for (const lockedDep of lockedDeps) {
      if (semver.matches(newVersion, lockedDep.constraint)) {
        logger.debug(
          `Dependency ${depName} can be updated from ${newVersion} to ${newVersion} in range ${lockedDep.constraint}`,
        );
        updateLockedDeps.push({ ...lockedDep, newVersion });
        continue;
      }
      logger.debug(
        `Dependency ${depName} cannot be updated from ${newVersion} to ${newVersion} in range ${lockedDep.constraint}`,
      );
      return { status: 'update-failed' };
    }
    // TODO #22198
    let newLockFileContent = lockFileContent!;
    for (const dependency of updateLockedDeps) {
      const { depName, constraint, newVersion } = dependency;
      newLockFileContent = replaceConstraintVersion(
        newLockFileContent,
        depName,
        constraint,
        newVersion,
      );
    }
    // istanbul ignore if: cannot test
    if (newLockFileContent === lockFileContent) {
      logger.debug('Failed to make any changes to lock file');
      return { status: 'update-failed' };
    }
    return { status: 'updated', files: { [lockFile]: newLockFileContent } };
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, 'updateLockedDependency() error');
    return { status: 'update-failed' };
  }
}
