import { isNonEmptyObject } from '@sindresorhus/is';
import type {
  PackageFile,
  SharedConstraint,
  SharedConstraints,
} from '../../../modules/manager/types.ts';
import { get as getVersioning } from '../../../modules/versioning/index.ts';
import { getToolConfig } from '../../../util/exec/containerbase.ts';
import {
  type ConstraintName,
  type ToolName,
  isToolName,
} from '../../../util/exec/types.ts';
import type { BranchUpgradeConfig } from '../../types.ts';

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
 * Whether `value` is the current value or version of `upgrade`.
 */
function isCurrentValue(
  value: string | null,
  upgrade: BranchUpgradeConfig,
): boolean {
  return (
    value === upgrade.currentValue ||
    value === upgrade.currentVersion ||
    value === upgrade.lockedVersion
  );
}

/**
 * Returns `constraint` with the new version of `upgrade`, or with `null` if the versioning of the tool reads that as no version, or `undefined` if `upgrade` does not update it.
 */
function getUpdatedConstraint(
  toolName: ToolName,
  constraint: SharedConstraint,
  upgrade: BranchUpgradeConfig,
): SharedConstraint | undefined {
  // only replace the value being updated, like for the `constraints` which a branch updates
  if (
    constraint.depName !== upgrade.depName ||
    !upgrade.newVersion ||
    !isCurrentValue(constraint.value, upgrade)
  ) {
    return undefined;
  }
  const versioning = getVersioning(getToolConfig(toolName)?.versioning);
  return {
    ...constraint,
    value: versioning.isVersion(upgrade.newVersion) ? upgrade.newVersion : null,
  };
}

function updateSharedConstraint(
  shared: SharedConstraints,
  upgrades: BranchUpgradeConfig[],
): SharedConstraints {
  const updates = upgrades.filter(
    (upgrade) =>
      upgrade.manager === shared.manager &&
      upgrade.packageFile === shared.packageFile &&
      upgrade.updateType !== 'replacement',
  );
  if (!updates.length) {
    return shared;
  }
  const constraints = Object.fromEntries(
    Object.entries(shared.constraints).map(([name, constraint]) => [
      name,
      // the managers only share the constraints of tools
      isToolName(name)
        ? updates.reduce(
            (current, upgrade) =>
              getUpdatedConstraint(name, current, upgrade) ?? current,
            constraint,
          )
        : constraint,
    ]),
  );
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
