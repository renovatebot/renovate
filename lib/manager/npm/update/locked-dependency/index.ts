import type { PackageJson } from 'type-fest';
import { logger } from '../../../../logger';
import { api as semver } from '../../../../versioning/npm';
import type { UpdateLockedConfig } from '../../../types';
import { updateDependency } from '../dependency';
import { findDepConstraints } from './dep-constraints';
import { getLockedDependencies } from './get-locked';
import { findFirstParentVersion } from './parent-version';
import type { PackageLockOrEntry } from './types';

export function validateInputs(config: UpdateLockedConfig): boolean {
  const { currentVersion, newVersion, lockFile } = config;
  if (!lockFile.endsWith('package-lock.json')) {
    logger.debug({ lockFile }, 'Unsupported lock file');
    return false;
  }
  if (!(semver.isVersion(currentVersion) && semver.isVersion(newVersion))) {
    logger.warn(
      { currentVersion, newVersion },
      'Update versions are not valid'
    );
    return false;
  }
  return true;
}

export async function updateLockedDependency(
  config: UpdateLockedConfig,
  isParentUpdate = false
): Promise<Record<string, string>> {
  const {
    depName,
    currentVersion,
    newVersion,
    packageFile,
    packageFileContent,
    lockFile,
    lockFileContent,
  } = config;
  logger.debug(
    `npm.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`
  );
  try {
    if (!validateInputs(config)) {
      return null;
    }
    let packageJson: PackageJson;
    let packageLockJson: PackageLockOrEntry;
    let newPackageJsonContent: string;
    try {
      packageJson = JSON.parse(packageFileContent);
      packageLockJson = JSON.parse(lockFileContent);
    } catch (err) {
      logger.warn({ err }, 'Failed to parse files');
      return null;
    }
    if (packageLockJson.lockfileVersion === 2) {
      logger.debug('Only lockfileVersion 1 is supported');
      return null;
    }
    const lockedDeps = getLockedDependencies(
      packageLockJson,
      depName,
      currentVersion
    );
    if (!lockedDeps.length) {
      logger.debug(
        `${depName}@${currentVersion} not found in ${lockFile} - no work to do`
      );
      // Don't return null if we're a parent update or else the whole update will fail
      // istanbul ignore if: too hard to replicate
      if (isParentUpdate) {
        const res = {};
        res[packageFile] = packageFileContent;
        res[lockFile] = lockFileContent;
        return res;
      }
      return null;
    }
    logger.debug(
      `Found matching dependencies with length ${lockedDeps.length}`
    );
    const constraints = findDepConstraints(
      packageJson,
      packageLockJson,
      depName,
      currentVersion,
      newVersion
    );
    logger.trace({ deps: lockedDeps, constraints }, 'Matching details');
    if (!constraints.length) {
      logger.warn('Could not find constraints for the locked dependency');
      return null;
    }
    const parentUpdates: UpdateLockedConfig[] = [];
    for (const {
      parentDepName,
      parentVersion,
      constraint,
      depType,
    } of constraints) {
      if (semver.matches(newVersion, constraint)) {
        // Parent dependency is compatible with the new version we want
        logger.debug(
          `${depName} can be updated to ${newVersion} in-range with matching constraint "${constraint}" in ${
            parentDepName ? `${parentDepName}@${parentVersion}` : packageFile
          }`
        );
      } else if (parentDepName && parentVersion) {
        // Parent dependency needs updating too
        const parentNewVersion = await findFirstParentVersion(
          parentDepName,
          parentVersion,
          depName,
          newVersion
        );
        if (parentNewVersion) {
          if (parentNewVersion === parentVersion) {
            logger.debug(
              `Update of ${depName} to ${newVersion} already achieved in parent ${parentDepName}@${parentNewVersion}`
            );
          } else {
            // Update the parent dependency so that we can update this dependency
            logger.debug(
              `Update of ${depName} to ${newVersion} can be achieved due to parent ${parentDepName}`
            );
            const parentUpdate: UpdateLockedConfig = {
              depName: parentDepName,
              currentVersion: parentVersion,
              newVersion: parentNewVersion,
            };
            parentUpdates.push(parentUpdate);
          }
        } else {
          // For some reason it's not possible to update the parent to a version compatible with our desired dep version
          logger.debug(
            `Update of ${depName} to ${newVersion} cannot be achieved due to parent ${parentDepName}`
          );
          return null;
        }
      } else if (depType) {
        // The constaint comes from the package.json file, so we need to update it
        const newValue = semver.getNewValue({
          currentValue: constraint,
          rangeStrategy: 'replace',
          currentVersion,
          newVersion,
        });
        newPackageJsonContent = updateDependency({
          fileContent: packageFileContent,
          upgrade: { depName, depType, newValue },
        });
      }
    }
    for (const dependency of lockedDeps) {
      // Remove resolved and integrity fields for npm to fill in
      dependency.version = newVersion;
      delete dependency.resolved;
      delete dependency.integrity;
    }
    let newLockFileContent = JSON.stringify(packageLockJson, null, 2);
    // iterate through the parent updates first
    for (const parentUpdate of parentUpdates) {
      const parentUpdateConfig = {
        ...config,
        lockFileContent: newLockFileContent,
        packageFileContent: newPackageJsonContent || packageFileContent,
        ...parentUpdate,
      };
      const parentUpdateResult = await updateLockedDependency(
        parentUpdateConfig,
        true
      );
      // istanbul ignore if: hard to test due to recursion
      if (!parentUpdateResult) {
        logger.debug(
          `Update of ${depName} to ${newVersion} impossible due to failed update of parent ${parentUpdate.depName} to ${parentUpdate.newVersion}`
        );
        return null;
      }
      newPackageJsonContent =
        parentUpdateResult[packageFile] || newPackageJsonContent;
      newLockFileContent = parentUpdateResult[lockFile] || newLockFileContent;
    }
    const files = {};
    if (newLockFileContent) {
      files[lockFile] = newLockFileContent;
    }
    if (newPackageJsonContent) {
      files[packageFile] = newPackageJsonContent;
    }
    return files;
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, 'updateLockedDependency() error');
    return null;
  }
}
