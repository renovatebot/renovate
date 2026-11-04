import { isNonEmptyObject } from '@sindresorhus/is';
import type {
  PackageFile,
  SharedConstraint,
  SharedConstraints,
} from '../../../modules/manager/types.ts';
import type { ConstraintName } from '../../../util/exec/types.ts';
import { regEx } from '../../../util/regex.ts';
import type { BranchUpgradeConfig } from '../../types.ts';

// the shared constraints are version numbers, optionally with build metadata like `+13`
const versionNumberRegex = regEx(/^\d+(?:\.\d+)*(?:\+[0-9A-Za-z.+-]+)?$/);

function getDepth(directory: string): number {
  return directory === '' ? 0 : directory.split('/').length;
}

function isInScope(directory: string, packageFile: string): boolean {
  return directory === '' || packageFile.startsWith(`${directory}/`);
}

/**
 * Orders the sources by depth, then by precedence, then by path in byte order, the order in which mise loads the `conf.d` files of a directory.
 */
function compareSources(a: SharedConstraints, b: SharedConstraints): number {
  return (
    getDepth(a.directory) - getDepth(b.directory) ||
    a.precedence - b.precedence ||
    Buffer.compare(Buffer.from(a.packageFile), Buffer.from(b.packageFile))
  );
}

/**
 * Collects the constraints which managers like `mise` share, in the order in which they apply, the last one winning.
 */
export function collectSharedConstraints(
  packageFiles: Record<string, PackageFile[]>,
): SharedConstraints[] {
  const sources: SharedConstraints[] = [];
  for (const [manager, files] of Object.entries(packageFiles)) {
    for (const { packageFile, sharedConstraintsScope: scope } of files) {
      if (scope && isNonEmptyObject(scope.constraints)) {
        sources.push({ ...scope, manager, packageFile });
      }
    }
  }
  return sources.sort(compareSources);
}

/**
 * Returns the new value of a shared constraint which `upgrade` updates, `null` if it is no version number, or `undefined` if `upgrade` does not update it.
 */
function getUpdatedValue(
  { value }: SharedConstraint,
  upgrade: BranchUpgradeConfig,
): string | null | undefined {
  // only replace the value being updated, like for the `constraints` which a branch updates
  let newValue: string | undefined;
  if (value === upgrade.currentValue) {
    newValue = upgrade.newValue;
  } else if (
    value === upgrade.lockedVersion ||
    value === upgrade.currentVersion
  ) {
    newValue = upgrade.newVersion;
  }
  if (!newValue) {
    return undefined;
  }
  return versionNumberRegex.test(newValue) ? newValue : null;
}

function updateSharedConstraint(
  shared: SharedConstraints,
  upgrades: BranchUpgradeConfig[],
): SharedConstraints {
  const constraints = { ...shared.constraints };
  for (const upgrade of upgrades) {
    if (
      upgrade.manager !== shared.manager ||
      upgrade.packageFile !== shared.packageFile ||
      upgrade.updateType === 'replacement'
    ) {
      continue;
    }
    for (const [name, constraint] of Object.entries(constraints)) {
      const value =
        constraint.depName === upgrade.depName
          ? getUpdatedValue(constraint, upgrade)
          : undefined;
      if (value !== undefined) {
        constraints[name as ConstraintName] = { ...constraint, value };
      }
    }
  }
  return { ...shared, constraints };
}

/**
 * Returns the shared constraints with the new values of the dependencies which `upgrades` update, without changing `sharedConstraints`.
 */
export function updateSharedConstraints(
  sharedConstraints: SharedConstraints[],
  upgrades: BranchUpgradeConfig[],
): SharedConstraints[] {
  return sharedConstraints.map((shared) =>
    updateSharedConstraint(shared, upgrades),
  );
}

/**
 * Returns the shared constraints which apply to a package file of `manager`, the nearest directory winning, leaving out those which `manager` shares itself and those without a value.
 */
export function getSharedConstraints(
  sharedConstraints: SharedConstraints[],
  manager: string,
  packageFile: string,
): Partial<Record<ConstraintName, string>> {
  const merged: Partial<Record<ConstraintName, SharedConstraint>> = {};
  for (const shared of sharedConstraints) {
    if (
      shared.manager !== manager &&
      isInScope(shared.directory, packageFile)
    ) {
      Object.assign(merged, shared.constraints);
    }
  }
  const constraints: Partial<Record<ConstraintName, string>> = {};
  for (const [name, { value }] of Object.entries(merged)) {
    if (value !== null) {
      constraints[name as ConstraintName] = value;
    }
  }
  return constraints;
}
