import url from 'url';
import { NpmResponse } from '../../datasource/npm/get';
import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import { readLocalFile, writeLocalFile } from '../../util/fs';
import { Http } from '../../util/http';
import { api as semver } from '../../versioning/npm';
import { UpdateLockedConfig } from '../common';
import { updateDependency } from './update';

const http = new Http('npm');

interface PackageLockDependency {
  version: string;
  resolved?: string;
  integrity?: string;
  dependencies?: Record<string, PackageLockDependency>;
}

type PackageLockDependencies = Record<string, PackageLockDependency>;

interface PackageLockOrEntry {
  version?: string;
  dependencies?: PackageLockDependencies;
  requires?: Record<string, string>;
}

export async function fetchRegistryDetails(
  depName: string
): Promise<NpmResponse> {
  const pkgUrl = url.resolve(
    'https://registry.npmjs.org/',
    encodeURIComponent(depName).replace(/^%40/, '@')
  );
  return (await http.getJson<NpmResponse>(pkgUrl)).body;
}

export async function findFirstParentVersion(
  parentName: string,
  parentStartingVersion: string,
  depName: string,
  targetVersion: string
): Promise<string | null> {
  logger.debug(
    `Finding first version of ${parentName} after ${parentStartingVersion} which supports >= ${depName}@${targetVersion}`
  );
  try {
    const dep = await fetchRegistryDetails(depName);
    const higherVersions = Object.keys(dep.versions)
      .filter((version) => semver.isGreaterThan(version, targetVersion))
      .filter(
        (version) => !semver.isStable(targetVersion) || semver.isStable(version)
      );
    const parentDep = await fetchRegistryDetails(parentName);
    const parentVersions = Object.keys(parentDep.versions)
      .filter(
        (version) =>
          semver.isStable(version) &&
          semver.isGreaterThan(version, parentStartingVersion)
      )
      .sort((v1, v2) => semver.sortVersions(v1, v2));
    // iterate through parentVersions in sorted order
    for (const parentVersion of parentVersions) {
      const { dependencies, devDependencies } = parentDep.versions[
        parentVersion
      ];
      const constraint = dependencies[depName] || devDependencies[depName];
      if (!constraint) {
        logger.debug(
          `${depName} has been removed from ${parentName}@${parentVersion}`
        );
        return parentVersion;
      }
      if (semver.matches(targetVersion, constraint)) {
        // could be version or range
        logger.debug(
          `${depName} needs ${parentName}@${parentVersion} which uses constraint "${constraint}" in order to update to ${targetVersion}`
        );
        return parentVersion;
      }
      if (semver.isVersion(constraint)) {
        if (semver.isGreaterThan(constraint, targetVersion)) {
          // it's not the version we were after - the parent skipped to a higher version
          logger.debug(
            `${depName} needs ${parentName}@${parentVersion} which uses constraint "${constraint}" in order to update to greater than ${targetVersion}`
          );
          return parentVersion;
        }
      } else if (
        higherVersions.some((version) => semver.matches(version, constraint))
      ) {
        // the constraint didn't match the version we wanted, but it matches one of the versions higher
        logger.debug(
          `${depName} needs ${parentName}@${parentVersion} which uses constraint "${constraint}" in order to update to greater than ${targetVersion}`
        );
        return parentVersion;
      }
    }
  } catch (err) {
    logger.debug({ err }, 'findFirstSupportingVersion error');
    return null;
  }
  logger.debug(`Could not find a matching version`);
  return null;
}

export interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface ParentDependency {
  parentDepName: string;
  parentVersion: string;
  constraint: string;
}

// Finds all parent dependencies for a given depName@currentVersion
export function getParentDependencies(
  packageJson: PackageJson,
  lockEntry: PackageLockOrEntry,
  depName: string,
  currentVersion: string,
  parentDepName?: string
): ParentDependency[] {
  let parents = [];
  let packageJsonConstraint = packageJson.dependencies?.[depName];
  if (packageJsonConstraint) {
    parents.push({
      parentDepName: 'dependencies',
      constraint: packageJsonConstraint,
    });
  }
  packageJsonConstraint = packageJson.devDependencies?.[depName];
  if (packageJsonConstraint) {
    parents.push({
      parentDepName: 'devDependencies',
      constraint: packageJsonConstraint,
    });
  }
  const { dependencies, requires, version } = lockEntry;
  if (parentDepName && requires) {
    const constraint = requires[depName];
    if (constraint && semver.matches(currentVersion, constraint)) {
      parents.push({
        parentDepName,
        parentVersion: version,
        constraint,
      });
    }
  }
  if (dependencies) {
    for (const [packageName, dependency] of Object.entries(dependencies)) {
      parents = parents.concat(
        getParentDependencies(
          packageJson,
          dependency,
          depName,
          currentVersion,
          packageName
        )
      );
    }
  }
  // dedupe
  const res = [];
  for (const req of parents) {
    const reqStringified = JSON.stringify(req);
    if (!res.find((i) => JSON.stringify(i) === reqStringified)) {
      res.push(req);
    }
  }
  return res;
}

// Finds matching dependencies withing a package lock file of sub-entry
export function getLockedDependencies(
  entry: PackageLockOrEntry,
  depName: string,
  currentVersion: string
): PackageLockDependency[] {
  const { dependencies } = entry;
  if (!dependencies) {
    return [];
  }
  let res: PackageLockDependency[] = [];
  try {
    if (dependencies[depName]?.version === currentVersion) {
      res.push(dependencies[depName]);
    }
    for (const dependency of Object.values(dependencies)) {
      res = res.concat(
        getLockedDependencies(dependency, depName, currentVersion)
      );
    }
  } catch (err) {
    logger.warn({ err }, 'getLockedDependencies() error');
  }
  return res;
}

export async function updateLockedDependency(
  config: UpdateLockedConfig,
  parent = false
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
  if (!lockFile.endsWith('package-lock.json')) {
    logger.debug({ lockFile }, 'Unsupported lock file');
    return null;
  }
  if (!(semver.isVersion(currentVersion) && semver.isVersion(newVersion))) {
    logger.warn(
      { currentVersion, newVersion },
      'Update versions are not valid'
    );
    return null;
  }
  logger.debug(
    `npm.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`
  );
  let packageJson: PackageJson;
  let packageLockJson: PackageLockOrEntry;
  let newPackageJsonContent: string;
  try {
    packageJson = JSON.parse(packageFileContent);
    packageLockJson = JSON.parse(lockFileContent);
  } catch (err) {
    logger.warn({ err }, 'Failed to parse package-lock.json');
    return null;
  }
  try {
    const lockedDeps = getLockedDependencies(
      packageLockJson,
      depName,
      currentVersion
    );
    if (!lockedDeps.length) {
      logger.debug(
        `${depName}@${currentVersion} not found in ${lockFile} - no work to do`
      );
      return null;
    }
    logger.debug(
      `Found matching dependencies with length ${lockedDeps.length}`
    );
    const parentDeps = getParentDependencies(
      packageJson,
      packageLockJson,
      depName,
      currentVersion
    );
    logger.trace({ deps: lockedDeps, parentDeps }, 'Matching details');
    if (!parentDeps.length) {
      logger.warn('Could not find parent requirements for update dependency');
      return null;
    }
    let canUpdate = true;
    const parentUpdates: UpdateLockedConfig[] = [];
    for (const { parentDepName, parentVersion, constraint } of parentDeps) {
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
          // Update the parent dependency so that we can update this dependency
          const parentUpdate: UpdateLockedConfig = {
            depName: parentDepName,
            currentVersion: parentVersion,
            newVersion: parentNewVersion,
          };
          parentUpdates.push(parentUpdate);
        } else {
          // For some reason it's not possible to update the parent to a version compatible with our desired dep version
          logger.debug(
            `Update of ${depName} to ${newVersion} cannot be achieved due to parent ${parentDepName}`
          );
          canUpdate = false;
        }
      } else {
        // The constaint comes from the package.json file, so we need to update it
        const newConstraint = semver.getNewValue({
          currentValue: constraint,
          rangeStrategy: 'replace',
          currentVersion,
          newVersion,
        });
        newPackageJsonContent = updateDependency({
          fileContent: packageFileContent,
          upgrade: { depName, depType: parentDepName, newValue: newConstraint },
        });
        if (newPackageJsonContent === packageFileContent) {
          logger.debug(
            `Update of ${depName} to ${newVersion} cannot be achieved because ${packageFile} update failed`
          );
          canUpdate = false;
        }
      }
    }
    if (!canUpdate) {
      return null;
    }
    for (const dependency of lockedDeps) {
      // Remove resolved and integrity fields for npm to fill in
      dependency.version = newVersion;
      delete dependency.resolved;
      delete dependency.integrity;
    }
    let newLockFileContent = JSON.stringify(packageLockJson);
    // iterate through the parent udpates first
    for (const parentUpdate of parentUpdates) {
      const parentUpdateConfig = {
        ...config,
        lockFileContent: newLockFileContent,
        ...parentUpdate,
      };
      const parentUpdateResult = await updateLockedDependency(
        parentUpdateConfig,
        true
      );
      if (!parentUpdateResult) {
        logger.debug(
          `Update of ${depName} to ${newVersion} impossible due to failed update of parent ${parentUpdate.depName} to ${parentUpdate.newVersion}`
        );
        return null;
      }
      newPackageJsonContent =
        parentUpdateResult[packageFile] || newPackageJsonContent;
      newLockFileContent = parentUpdateResult[lockFile];
    }
    // Run npm install if this update is not a parent update. We want to run it only once
    if (!parent) {
      // TODO: unify with post-updates
      await writeLocalFile(lockFile, newLockFileContent);
      if (newPackageJsonContent) {
        await writeLocalFile(packageFile, newPackageJsonContent);
      }
      const execOptions: ExecOptions = {
        cwdFile: lockFile,
        docker: {
          image: 'renovate/node',
        },
      };
      const commands = [`npm install`];
      const res = await exec(commands, execOptions);
      logger.debug({ commands, res }, 'res');
      newLockFileContent = await readLocalFile(lockFile, 'utf8');
      if (newLockFileContent === lockFileContent) {
        logger.debug('Package lock is unchanged');
        return null;
      }
    }
    // Now check if we successfully remediated what we needed
    const newPackageLock = JSON.parse(newLockFileContent);
    const nonUpdatedDependencies = getLockedDependencies(
      newPackageLock,
      depName,
      currentVersion
    );
    if (nonUpdatedDependencies.length) {
      logger.info({ nonUpdatedDependencies }, 'Update incomplete');
      return null;
    }
    const files = {};
    files[lockFile] = newLockFileContent;
    if (newPackageJsonContent) {
      files[packageFile] = newPackageJsonContent;
    }
    return files;
  } catch (err) {
    logger.warn({ err }, 'updateLockedDependency() error');
    return null;
  }
}
