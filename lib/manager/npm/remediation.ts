import url from 'url';
import { NpmResponse } from '../../datasource/npm/get';
import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import { readLocalFile, writeLocalFile } from '../../util/fs';
import { Http } from '../../util/http';
import { api as semver } from '../../versioning/npm';
import { RemediationConfig } from '../common';
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

async function findFirstSupportingVersion(
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
            `${depName} needs ${parentName}@${parentVersion} which uses constraint "${constraint}" in order to remediate to ${targetVersion}`
          );
          return parentVersion;
        }
        if (semver.isVersion(constraint)) {
          if (semver.isGreaterThan(constraint, targetVersion)) {
            logger.debug(
              `${depName} needs ${parentName}@${parentVersion} which uses constraint "${constraint}" in order to remediate to greater than ${targetVersion}`
            );
            return parentVersion;
          }
        } else if (
          depNameHigherVersions.some((version) =>
            semver.matches(version, constraint)
          )
        ) {
          logger.debug(
            `${depName} needs ${parentName}@${parentVersion} which uses constraint "${constraint}" in order to remediate to greater than ${targetVersion}`
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

function getLockRequirements(
  packageJson: any,
  entry: PackageLockEntry,
  depToRemediate: string,
  currentVersion: string,
  parentDepName?: string
): LockRequirements[] {
  let reqs = [];
  const { dependencies, requires, version } = entry;
  let packageJsonConstraint = packageJson.dependencies?.[depToRemediate];
  if (packageJsonConstraint) {
    reqs.push({
      parentDepName: 'dependencies',
      constraint: packageJsonConstraint,
    });
  }
  packageJsonConstraint = packageJson.devDependencies?.[depToRemediate];
  if (packageJsonConstraint) {
    reqs.push({
      parentDepName: 'devDependencies',
      constraint: packageJsonConstraint,
    });
  }
  if (parentDepName && requires) {
    const constraint = requires[depToRemediate];
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
          depToRemediate,
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

function getMatchingDependencies(
  entry: PackageLockEntry,
  depToRemediate: string,
  versionToRemediate: string,
  parent?: string
): MatchingDependencies[] {
  const { dependencies } = entry;
  if (!dependencies) {
    return [];
  }
  let res = [];
  if (dependencies[depToRemediate]?.version === versionToRemediate) {
    res.push({ dependency: dependencies[depToRemediate], parent });
  }
  try {
    for (const [depName, depDetails] of Object.entries(dependencies)) {
      const parentString = parent ? `${parent}.${depName}` : depName;
      res = res.concat(
        getMatchingDependencies(
          depDetails,
          depToRemediate,
          versionToRemediate,
          parentString
        )
      );
    }
  } catch (err) {
    logger.warn({ err }, 'Error finding nested dependencies');
  }
  return res;
}

export async function remediateLockFile(
  config: RemediationConfig,
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
    logger.debug({ lockFile }, 'Unsupported remediation file');
    return null;
  }
  logger.debug(
    `npm.remediationLock: ${depName}@${currentVersion} -> ${newVersion}${
      parent ? ` [parent]` : ``
    }`
  );
  if (!(semver.isVersion(currentVersion) && semver.isVersion(newVersion))) {
    logger.warn(
      { currentVersion, newVersion },
      'Remediate values are not valid'
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
      logger.debug(
        'Could not find parent requirements for remediation dependency'
      );
      return null;
    }
    let canRemediate = true;
    const parentRemediations: RemediationConfig[] = [];
    for (const {
      parentDepName,
      parentVersion,
      constraint,
    } of lockRequirements) {
      if (semver.matches(newVersion, constraint)) {
        logger.debug(
          `${depName} can be remediated to ${newVersion} in-range due to constraint "${constraint}" in ${
            parentDepName ? `${parentDepName}@${parentVersion}` : packageFile
          }`
        );
      } else if (parentDepName && parentVersion) {
        const parentRemediatedVersion = await findFirstSupportingVersion(
          parentDepName,
          parentVersion,
          depName,
          newVersion
        );
        if (parentRemediatedVersion) {
          const parentRemediation: RemediationConfig = {
            depName: parentDepName,
            currentVersion: parentVersion,
            newVersion: parentRemediatedVersion,
          };
          parentRemediations.push(parentRemediation);
        } else {
          logger.debug(
            `Remediation of ${depName} to ${newVersion} cannot be achieved due to parent ${parentDepName}`
          );
          canRemediate = false;
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
            `Remediation of ${depName} to ${newVersion} cannot be achieved as need to update ${packageFile}`
          );
          canRemediate = false;
        }
      }
    }
    if (!canRemediate) {
      return null;
    }
    for (const { dependency } of matchingDependencies) {
      dependency.version = newVersion;
      delete dependency.resolved;
      delete dependency.integrity;
    }
    let newLockFileContent = JSON.stringify(packageLockJson);
    for (const parentRemediation of parentRemediations) {
      const parentRemediationConfig = {
        ...config,
        lockFileContent: newLockFileContent,
        ...parentRemediation,
      };
      const parentRemediationResult = await remediateLockFile(
        parentRemediationConfig,
        true
      );
      if (!parentRemediationResult) {
        logger.debug(
          `Remediaton of ${depName} to ${newVersion} impossible due to failed remediation of parent ${parentRemediation.depName} to ${parentRemediation.newVersion}`
        );
        return null;
      }
      newPackageJsonContent =
        parentRemediationResult[packageFile] || newPackageJsonContent;
      newLockFileContent = parentRemediationResult[lockFile];
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
    const unremediatedDependencies = getMatchingDependencies(
      newPackageLock,
      depName,
      currentVersion
    );
    if (unremediatedDependencies.length) {
      logger.info({ unremediatedDependencies }, 'Remediation incomplete');
      return null;
    }
    logger.debug('Remediation successful');
    const files = {};
    files[lockFile] = newLockFileContent;
    if (newPackageJsonContent) {
      files[packageFile] = newPackageJsonContent;
    }
    return files;
  } catch (err) {
    logger.warn({ err }, 'Remediation error');
  }
  return null;
}
