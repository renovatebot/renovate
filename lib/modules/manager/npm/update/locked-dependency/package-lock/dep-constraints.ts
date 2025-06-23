import type { PackageJson } from 'type-fest';
import { logger } from '../../../../../../logger';
import { regEx } from '../../../../../../util/regex';
import { api as semver } from '../../../../../versioning/npm';
import type { PackageLockOrEntry, ParentDependency } from './types';

// Finds all parent dependencies for a given depName@currentVersion
export function findDepConstraints(
  packageJson: PackageJson,
  lockEntry: PackageLockOrEntry,
  depName: string,
  currentVersion: string,
  newVersion: string,
  parentDepName?: string,
): ParentDependency[] {
  let parents: ParentDependency[] = [];
  let packageJsonConstraint = packageJson.dependencies?.[depName];
  if (
    packageJsonConstraint &&
    semver.matches(currentVersion, packageJsonConstraint)
  ) {
    parents.push({
      depType: 'dependencies',
      constraint: packageJsonConstraint,
    });
  }
  packageJsonConstraint = packageJson.devDependencies?.[depName];
  if (
    packageJsonConstraint &&
    semver.matches(currentVersion, packageJsonConstraint)
  ) {
    parents.push({
      depType: 'devDependencies',
      constraint: packageJsonConstraint,
    });
  }
  const { dependencies, requires, version } = lockEntry;
  if (parentDepName && requires) {
    let constraint = requires[depName];
    if (constraint) {
      constraint = constraint.replace(regEx(/(\d)rc$/), '$1-rc');
      // istanbul ignore else
      if (semver.isValid(constraint)) {
        if (semver.matches(currentVersion, constraint)) {
          if (constraint === currentVersion) {
            // Workaround for old versions of npm which wrote the exact version in requires instead of the constraint
            requires[depName] = newVersion;
          }
          parents.push({
            parentDepName,
            parentVersion: version,
            constraint,
          });
        }
      } else {
        logger.warn(
          { parentDepName, depName, currentVersion, constraint },
          'Parent constraint is invalid',
        );
      }
    }
  }
  if (dependencies) {
    for (const [packageName, dependency] of Object.entries(dependencies)) {
      parents = parents.concat(
        findDepConstraints(
          packageJson,
          dependency,
          depName,
          currentVersion,
          newVersion,
          packageName,
        ),
      );
    }
  }
  // dedupe
  const res: ParentDependency[] = [];
  for (const req of parents) {
    const reqStringified = JSON.stringify(req);
    if (!res.find((i) => JSON.stringify(i) === reqStringified)) {
      res.push(req);
    }
  }
  return res;
}
