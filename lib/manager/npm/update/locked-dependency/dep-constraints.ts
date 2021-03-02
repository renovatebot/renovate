import type { PackageJson } from 'type-fest';

import { api as semver } from '../../../../versioning/npm';
import { PackageLockOrEntry, ParentDependency } from './common';

// Finds all parent dependencies for a given depName@currentVersion
export function findDepConstraints(
  packageJson: PackageJson,
  lockEntry: PackageLockOrEntry,
  depName: string,
  currentVersion: string,
  parentDepName?: string
): ParentDependency[] {
  let parents: ParentDependency[] = [];
  let packageJsonConstraint = packageJson.dependencies?.[depName];
  if (packageJsonConstraint) {
    parents.push({
      depType: 'dependencies',
      constraint: packageJsonConstraint,
    });
  }
  packageJsonConstraint = packageJson.devDependencies?.[depName];
  if (packageJsonConstraint) {
    parents.push({
      depType: 'devDependencies',
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
        findDepConstraints(
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
  const res: ParentDependency[] = [];
  for (const req of parents) {
    const reqStringified = JSON.stringify(req);
    if (!res.find((i) => JSON.stringify(i) === reqStringified)) {
      res.push(req);
    }
  }
  return res;
}
