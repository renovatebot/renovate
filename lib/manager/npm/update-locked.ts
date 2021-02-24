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

interface PackageLockEntry {
  version?: string;
  dependencies?: PackageLockDependencies;
  requires?: Record<string, string>;
}

interface MatchingDependencies {
  dependency: PackageLockDependency;
  parentDependency: string;
}

interface LockRequirements {
  parentDepName: string;
  parentVersion: string;
  constraint: string;
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
    let pkgUrl = url.resolve(
      'https://registry.npmjs.org/',
      encodeURIComponent(depName).replace(/^%40/, '@')
    );
    let registryEntry = await http.getJson<NpmResponse>(pkgUrl);
    const depNameHigherVersions = Object.keys(registryEntry.body.versions)
      .filter((version) => semver.isGreaterThan(version, targetVersion))
      .filter(
        (version) => !semver.isStable(targetVersion) || semver.isStable(version)
      );
    pkgUrl = url.resolve(
      'https://registry.npmjs.org/',
      encodeURIComponent(parentName).replace(/^%40/, '@')
    );
    registryEntry = await http.getJson<NpmResponse>(pkgUrl);
    let parentVersions = Object.keys(
      registryEntry.body.versions
    ).sort((v1, v2) => semver.sortVersions(v1, v2));
    if (semver.isStable(targetVersion)) {
      parentVersions = parentVersions.filter((v) => semver.isStable(v));
    }
    for (const parentVersion of parentVersions) {
      const { dependencies, devDependencies } = registryEntry.body.versions[
        parentVersion
      ];
      if (semver.isGreaterThan(parentVersion, parentStartingVersion)) {
        if (!(dependencies[depName] || devDependencies[depName])) {
          logger.debug(
            `${depName} has been removed from ${parentName}@${parentVersion}`
          );
          return parentVersion;
        }
        const constraint = dependencies[depName] || devDependencies[depName];
        if (constraint && semver.matches(targetVersion, constraint)) {
          logger.debug(
            `${depName} needs ${parentName}@${parentVersion} which uses constraint "${constraint}" in order to update to ${targetVersion}`
          );
          return parentVersion;
        }
        if (semver.isVersion(constraint)) {
          if (semver.isGreaterThan(constraint, targetVersion)) {
            logger.debug(
              `${depName} needs ${parentName}@${parentVersion} which uses constraint "${constraint}" in order to update to greater than ${targetVersion}`
            );
            return parentVersion;
          }
        } else if (
          depNameHigherVersions.some((version) =>
            semver.matches(version, constraint)
          )
        ) {
          logger.debug(
            `${depName} needs ${parentName}@${parentVersion} which uses constraint "${constraint}" in order to update to greater than ${targetVersion}`
          );
          return parentVersion;
        }
      }
    }
  } catch (err) {
    logger.debug({ err }, 'findFirstSupportingVersion error');
  }
  logger.debug(`Could not find a matching version`);
  return null;
}

export function getLockRequirements(
  packageJson: any,
  entry: PackageLockEntry,
  depName: string,
  currentVersion: string,
  parentDepName?: string
): LockRequirements[] {
  let reqs = [];
  const { dependencies, requires, version } = entry;
  let packageJsonConstraint = packageJson.dependencies?.[depName];
  if (packageJsonConstraint) {
    reqs.push({
      parentDepName: 'dependencies',
      constraint: packageJsonConstraint,
    });
  }
  packageJsonConstraint = packageJson.devDependencies?.[depName];
  if (packageJsonConstraint) {
    reqs.push({
      parentDepName: 'devDependencies',
      constraint: packageJsonConstraint,
    });
  }
  if (parentDepName && requires) {
    const constraint = requires[depName];
    if (constraint && semver.matches(currentVersion, constraint)) {
      const lockRequirement: LockRequirements = {
        parentDepName,
        parentVersion: version,
        constraint,
      };
      reqs.push(lockRequirement);
    }
  }
  if (dependencies) {
    for (const [packageName, dependency] of Object.entries(dependencies)) {
      reqs = reqs.concat(
        getLockRequirements(
          packageJson,
          dependency,
          depName,
          currentVersion,
          packageName
        )
      );
    }
  }
  const res = [];
  for (const req of reqs) {
    const reqStringified = JSON.stringify(req);
    if (!res.find((i) => JSON.stringify(i) === reqStringified)) {
      res.push(req);
    }
  }
  return res;
}

export function getMatchingDependencies(
  entry: PackageLockEntry,
  depName: string,
  currentVersion: string,
  parent?: string
): MatchingDependencies[] {
  const { dependencies } = entry;
  if (!dependencies) {
    return [];
  }
  let res = [];
  if (dependencies[depName]?.version === currentVersion) {
    res.push({ dependency: dependencies[depName], parent });
  }
  try {
    for (const [dependency, depDetails] of Object.entries(dependencies)) {
      const parentString = parent ? `${parent}.${dependency}` : dependency;
      res = res.concat(
        getMatchingDependencies(
          depDetails,
          depName,
          currentVersion,
          parentString
        )
      );
    }
  } catch (err) {
    logger.warn({ err }, 'Error finding nested dependencies');
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
  logger.debug(
    `npm.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion}${
      parent ? ` [parent]` : ``
    }`
  );
  if (!(semver.isVersion(currentVersion) && semver.isVersion(newVersion))) {
    logger.warn(
      { currentVersion, newVersion },
      'Update versions are not valid'
    );
    return null;
  }
  let packageJson: any;
  let packageLockJson: PackageLockEntry;
  let newPackageJsonContent: string;
  try {
    packageJson = JSON.parse(packageFileContent);
    packageLockJson = JSON.parse(lockFileContent);
  } catch (err) {
    logger.warn({ err }, 'Failed to parse package-lock.json');
    return null;
  }
  logger.trace(`Parsed ${lockFile}`);
  try {
    const matchingDependencies = getMatchingDependencies(
      packageLockJson,
      depName,
      currentVersion
    );
    if (!matchingDependencies.length) {
      logger.debug(
        `${depName}@${currentVersion} not found in ${lockFile} - no work to do`
      );
      return null;
    }
    logger.debug(
      { matchingDependenciesCount: matchingDependencies.length },
      'Matching dependencies result'
    );
    const lockRequirements = getLockRequirements(
      packageJson,
      packageLockJson,
      depName,
      currentVersion
    );
    logger.info({ matchingDependencies, lockRequirements }, 'info');
    if (!lockRequirements.length) {
      logger.debug('Could not find parent requirements for update dependency');
      return null;
    }
    let canUpdate = true;
    const parentUpdates: UpdateLockedConfig[] = [];
    for (const {
      parentDepName,
      parentVersion,
      constraint,
    } of lockRequirements) {
      if (semver.matches(newVersion, constraint)) {
        logger.debug(
          `${depName} can be updated to ${newVersion} in-range with matching constraint "${constraint}" in ${
            parentDepName ? `${parentDepName}@${parentVersion}` : packageFile
          }`
        );
      } else if (parentDepName && parentVersion) {
        const parentUpdateVersion = await findFirstParentVersion(
          parentDepName,
          parentVersion,
          depName,
          newVersion
        );
        if (parentUpdateVersion) {
          const parentUpdate: UpdateLockedConfig = {
            depName: parentDepName,
            currentVersion: parentVersion,
            newVersion: parentUpdateVersion,
          };
          parentUpdates.push(parentUpdate);
        } else {
          logger.debug(
            `Update of ${depName} to ${newVersion} cannot be achieved due to parent ${parentDepName}`
          );
          canUpdate = false;
        }
      } else {
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
            `Update of ${depName} to ${newVersion} cannot be achieved as need to update ${packageFile}`
          );
          canUpdate = false;
        }
      }
    }
    if (!canUpdate) {
      return null;
    }
    for (const { dependency } of matchingDependencies) {
      dependency.version = newVersion;
      delete dependency.resolved;
      delete dependency.integrity;
    }
    let newLockFileContent = JSON.stringify(packageLockJson);
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
    const newPackageLock = JSON.parse(newLockFileContent);
    const nonUpdatedDependencies = getMatchingDependencies(
      newPackageLock,
      depName,
      currentVersion
    );
    if (nonUpdatedDependencies.length) {
      logger.info({ nonUpdatedDependencies }, 'Update incomplete');
      return null;
    }
    logger.debug('Lock update successful');
    const files = {};
    files[lockFile] = newLockFileContent;
    if (newPackageJsonContent) {
      files[packageFile] = newPackageJsonContent;
    }
    return files;
  } catch (err) {
    logger.warn({ err }, 'Lock update error');
  }
  return null;
}
