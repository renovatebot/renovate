import { isNonEmptyObject } from '@sindresorhus/is';
import type {
  PackageFile,
  SharedConstraints,
  SharedConstraintsScope,
} from '../../../modules/manager/types.ts';
import type { ConstraintName } from '../../../util/exec/types.ts';

interface SharedConstraintsSource extends SharedConstraintsScope {
  manager: string;
  packageFile: string;
}

function getDepth(directory: string): number {
  return directory === '' ? 0 : directory.split('/').length;
}

function isInScope(directory: string, packageFile: string): boolean {
  return directory === '' || packageFile.startsWith(`${directory}/`);
}

/**
 * Orders the sources by depth, then by precedence, then by path in byte order, the order in which mise loads the `conf.d` files of a directory.
 */
function compareSources(
  a: SharedConstraintsSource,
  b: SharedConstraintsSource,
): number {
  return (
    getDepth(a.directory) - getDepth(b.directory) ||
    a.precedence - b.precedence ||
    Buffer.compare(Buffer.from(a.packageFile), Buffer.from(b.packageFile))
  );
}

function getSources(
  packageFiles: Record<string, PackageFile[]>,
): SharedConstraintsSource[] {
  const sources: SharedConstraintsSource[] = [];
  for (const [manager, files] of Object.entries(packageFiles)) {
    for (const { packageFile, sharedConstraintsScope: scope } of files) {
      if (scope && isNonEmptyObject(scope.constraints)) {
        sources.push({ ...scope, manager, packageFile });
      }
    }
  }
  return sources;
}

/**
 * Collects the constraints which managers like `mise` share, merged per manager and directory by their precedence, shallower directories first.
 */
export function collectSharedConstraints(
  packageFiles: Record<string, PackageFile[]>,
): SharedConstraints[] {
  const shared = new Map<string, SharedConstraints>();
  for (const { manager, directory, constraints } of getSources(
    packageFiles,
  ).sort(compareSources)) {
    const key = `${manager}:${directory}`;
    const entry = shared.get(key) ?? { manager, directory, constraints: {} };
    // the lower precedence comes first, so the higher one wins
    entry.constraints = { ...entry.constraints, ...constraints };
    shared.set(key, entry);
  }
  return [...shared.values()];
}

/**
 * Returns the shared constraints which apply to a package file of `manager`, the nearest directory winning, leaving out those which `manager` shares itself.
 */
export function getSharedConstraints(
  sharedConstraints: SharedConstraints[],
  manager: string,
  packageFile: string,
): Partial<Record<ConstraintName, string>> {
  const constraints: Partial<Record<ConstraintName, string>> = {};
  for (const shared of sharedConstraints) {
    if (
      shared.manager !== manager &&
      isInScope(shared.directory, packageFile)
    ) {
      Object.assign(constraints, shared.constraints);
    }
  }
  return constraints;
}
