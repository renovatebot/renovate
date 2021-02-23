import url from 'url';
import { NpmResponse } from '../../datasource/npm/get';
import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import { readLocalFile, writeLocalFile } from '../../util/fs';
import { Http } from '../../util/http';
import { api as semver } from '../../versioning/npm';
import { RemediationConfig } from '../common';

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
      parentDepName: packageJson.name,
      parentVersion: packageJson.version,
      constraint: packageJsonConstraint,
    });
  }
  packageJsonConstraint = packageJson.devDependencies?.[depToRemediate];
  if (packageJsonConstraint) {
    reqs.push({
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
    currentValue,
    newValue,
    packageFileContent,
    lockFile,
    lockFileContent,
  } = config;
  if (!lockFile.endsWith('package-lock.json')) {
    logger.debug({ lockFile }, 'Unsupported remediation file');
    return null;
  }
  logger.debug({ depName, currentValue, newValue }, 'npm remediation');
  if (!(semver.isVersion(currentValue) && semver.isVersion(newValue))) {
    logger.warn({ currentValue, newValue }, 'Remediate values are not valid');
    return null;
  }
  let packageJson: any;
  let packageLockJson: PackageLockEntry;
  try {
    packageJson = JSON.parse(packageFileContent);
    packageLockJson = JSON.parse(lockFileContent);
  } catch (err) {
    logger.warn({ err }, 'Failed to parse package-lock.json');
    return null;
  }
  logger.trace('Parsed package-lock.json');
  try {
    const matchingDependencies = getMatchingDependencies(
      packageLockJson,
      depName,
      currentValue
    );
    if (!matchingDependencies.length) {
      logger.debug(
        { depName, currentValue },
        'No vulnerable version found in lock file'
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
      currentValue
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
      if (semver.matches(newValue, constraint)) {
        logger.debug(
          `${depName} can be remediated to ${newValue} in-range due to constraint "${constraint}" in ${
            parentDepName ? `${parentDepName}@${parentVersion}` : 'package.json'
          }`
        );
      } else {
        logger.debug(
          `${depName} cannot be remediated to ${newValue} in-range due to constraint "${constraint}" in ${parentDepName}@${parentVersion}`
        );
        const parentRemediatedVersion = await findFirstSupportingVersion(
          parentDepName,
          parentVersion,
          depName,
          newValue
        );
        if (parentRemediatedVersion) {
          const parentRemediation: RemediationConfig = {
            depName: parentDepName,
            currentValue: parentVersion,
            newValue: parentRemediatedVersion,
          };
          parentRemediations.push(parentRemediation);
        } else {
          logger.debug(
            `Remediation of ${depName} to ${newValue} cannot be achieved due to parent ${parentDepName}`
          );
          canRemediate = false;
        }
      }
    }
    if (!canRemediate) {
      return null;
    }
    for (const { dependency } of matchingDependencies) {
      dependency.version = newValue;
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
          `Remediaton of ${depName} to ${newValue} impossible due to failed remediation of parent ${parentRemediation.depName} to ${parentRemediation.newValue}`
        );
        return null;
      }
      newLockFileContent = parentRemediationResult[lockFile];
    }
    if (!parent) {
      await writeLocalFile(lockFile, newLockFileContent);
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
      currentValue
    );
    if (unremediatedDependencies.length) {
      logger.info({ unremediatedDependencies }, 'Remediation incomplete');
      return null;
    }
    logger.debug('Remediation successful');
    const files = {};
    files[lockFile] = newLockFileContent;
    return files;
  } catch (err) {
    logger.warn({ err }, 'Remediation error');
  }
  return null;
}
