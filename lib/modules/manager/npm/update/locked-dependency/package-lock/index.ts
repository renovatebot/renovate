import detectIndent from 'detect-indent';
import type { PackageJson } from 'type-fest';
import { logger } from '../../../../../../logger';
import { api as semver } from '../../../../../versioning/npm';
import type { UpdateLockedConfig, UpdateLockedResult } from '../../../../types';
import { updateDependency } from '../../dependency';
import { findFirstParentVersion } from '../common/parent-version';
import { findDepConstraints } from './dep-constraints';
import { getLockedDependencies } from './get-locked';
import type { PackageLockOrEntry } from './types';

export async function updateLockedDependency(
  config: UpdateLockedConfig,
  isParentUpdate = false,
): Promise<UpdateLockedResult> {
  const {
    depName,
    currentVersion,
    newVersion,
    packageFile,
    packageFileContent,
    lockFile,
    lockFileContent,
    allowParentUpdates = true,
    allowHigherOrRemoved = false,
  } = config;
  logger.debug(
    `npm.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`,
  );
  try {
    let packageJson: PackageJson;
    let packageLockJson: PackageLockOrEntry;
    // TODO #22198
    const detectedIndent = detectIndent(lockFileContent!).indent || '  ';
    let newPackageJsonContent: string | null | undefined;
    try {
      // TODO #22198
      packageJson = JSON.parse(packageFileContent!);
      packageLockJson = JSON.parse(lockFileContent!);
    } catch (err) {
      logger.warn({ err }, 'Failed to parse files');
      return { status: 'update-failed' };
    }
    const { lockfileVersion } = packageLockJson;
    const lockedDeps = getLockedDependencies(
      packageLockJson,
      depName,
      currentVersion,
    );
    if (lockedDeps.some((dep) => dep.bundled)) {
      logger.info(
        `Package ${depName}@${currentVersion} is bundled and cannot be updated`,
      );
      return { status: 'update-failed' };
    }
    if (!lockedDeps.length) {
      const newLockedDeps = getLockedDependencies(
        packageLockJson,
        depName,
        newVersion,
      );
      let status: 'update-failed' | 'already-updated';
      if (newLockedDeps.length) {
        logger.debug(
          `${depName}@${currentVersion} not found in ${lockFile} but ${depName}@${newVersion} was - looks like it's already updated`,
        );
        status = 'already-updated';
      } else {
        if (lockfileVersion !== 1) {
          logger.debug(
            // TODO: types (#22198)
            `Found lockfileVersion ${packageLockJson.lockfileVersion!}`,
          );
          status = 'update-failed';
        } else if (allowHigherOrRemoved) {
          // it's acceptable if the package is no longer present
          const anyVersionLocked = getLockedDependencies(
            packageLockJson,
            depName,
            null,
          );
          if (anyVersionLocked.length) {
            if (
              anyVersionLocked.every((dep) =>
                semver.isGreaterThan(dep.version, newVersion),
              )
            ) {
              logger.debug(
                `${depName} found in ${lockFile} with higher version - looks like it's already updated`,
              );
              status = 'already-updated';
            } else {
              logger.debug(
                { anyVersionLocked },
                `Found alternative versions of qs`,
              );
              status = 'update-failed';
            }
          } else {
            logger.debug(
              `${depName} not found in ${lockFile} - looks like it's already removed`,
            );
            status = 'already-updated';
          }
        } else {
          logger.debug(
            `${depName}@${currentVersion} not found in ${lockFile} - cannot update`,
          );
          status = 'update-failed';
        }
      }
      // Don't return {} if we're a parent update or else the whole update will fail
      // istanbul ignore if: too hard to replicate
      if (isParentUpdate) {
        const files: Record<string, string> = {};
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        files[packageFile!] = packageFileContent!;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        files[lockFile!] = lockFileContent!;
        return { status, files };
      }
      return { status };
    }
    logger.debug(
      `Found matching dependencies with length ${lockedDeps.length}`,
    );
    const constraints = findDepConstraints(
      packageJson,
      packageLockJson,
      depName,
      currentVersion,
      newVersion,
    );
    logger.trace({ deps: lockedDeps, constraints }, 'Matching details');
    if (!constraints.length) {
      logger.info(
        { depName, currentVersion, newVersion },
        'Could not find constraints for the locked dependency - cannot remediate',
      );
      return { status: 'update-failed' };
    }
    const parentUpdates: Partial<UpdateLockedConfig>[] = [];
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
            // TODO: types (#22198)
            parentDepName
              ? `${parentDepName}@${parentVersion!}`
              : /* istanbul ignore next: hard to test */ packageFile
          }`,
        );
      } else if (parentDepName && parentVersion) {
        if (!allowParentUpdates) {
          logger.debug(
            `Cannot update ${depName} to ${newVersion} without an update to ${parentDepName}`,
          );
          return { status: 'update-failed' };
        }
        // Parent dependency needs updating too
        const parentNewVersion = await findFirstParentVersion(
          parentDepName,
          parentVersion,
          depName,
          newVersion,
        );
        if (parentNewVersion) {
          if (parentNewVersion === parentVersion) {
            logger.debug(
              `Update of ${depName} to ${newVersion} already achieved in parent ${parentDepName}@${parentNewVersion}`,
            );
          } else {
            // Update the parent dependency so that we can update this dependency
            logger.debug(
              `Update of ${depName} to ${newVersion} can be achieved due to parent ${parentDepName}`,
            );
            const parentUpdate: Partial<UpdateLockedConfig> = {
              depName: parentDepName,
              currentVersion: parentVersion,
              newVersion: parentNewVersion,
            };
            parentUpdates.push(parentUpdate);
          }
        } else {
          // For some reason it's not possible to update the parent to a version compatible with our desired dep version
          logger.debug(
            `Update of ${depName} to ${newVersion} cannot be achieved due to parent ${parentDepName}`,
          );
          return { status: 'update-failed' };
        }
      } else if (depType) {
        // TODO: `newValue` can probably null
        // The constraint comes from the package.json file, so we need to update it
        const newValue = semver.getNewValue({
          currentValue: constraint,
          rangeStrategy: 'replace',
          currentVersion,
          newVersion,
        })!;
        newPackageJsonContent = updateDependency({
          // TODO #22198
          fileContent: packageFileContent!,
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
    let newLockFileContent = JSON.stringify(
      packageLockJson,
      null,
      detectedIndent,
    );
    // iterate through the parent updates first
    for (const parentUpdate of parentUpdates) {
      const parentUpdateConfig = {
        ...config,
        ...parentUpdate,
        lockFileContent: newLockFileContent,
        packageFileContent: newPackageJsonContent ?? packageFileContent,
      };
      const parentUpdateResult = await updateLockedDependency(
        parentUpdateConfig,
        true,
      );
      // istanbul ignore if: hard to test due to recursion
      if (!parentUpdateResult.files) {
        logger.debug(
          // TODO: types (#22198)
          `Update of ${depName} to ${newVersion} impossible due to failed update of parent ${parentUpdate.depName} to ${parentUpdate.newVersion}`,
        );
        return { status: 'update-failed' };
      }
      newPackageJsonContent =
        parentUpdateResult.files[packageFile] || newPackageJsonContent;
      newLockFileContent =
        parentUpdateResult.files[lockFile] ||
        /* istanbul ignore next: hard to test */ newLockFileContent;
    }
    const files: Record<string, string> = {};
    if (newLockFileContent) {
      files[lockFile] = newLockFileContent;
    }
    if (newPackageJsonContent) {
      files[packageFile] = newPackageJsonContent;
    } else if (lockfileVersion !== 1) {
      logger.debug(
        'Remediations which change package-lock.json only are not supported unless lockfileVersion=1',
      );
      return { status: 'unsupported' };
    }
    return { status: 'updated', files };
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, 'updateLockedDependency() error');
    return { status: 'update-failed' };
  }
}
