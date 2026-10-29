import { isNonEmptyObject } from '@sindresorhus/is';
import type {
  PackageFile,
  SharedConstraints,
  SharedConstraintsScope,
} from '../../../modules/manager/types.ts';
import { coerceArray } from '../../../util/array.ts';
import type { ConstraintName } from '../../../util/exec/types.ts';
import { coerceObject } from '../../../util/object.ts';

interface SharedConstraintsSource extends SharedConstraintsScope {
  manager: string;
  packageFile: string;
  constraints: Partial<Record<ConstraintName, string>>;
}

function getDepth(directory: string): number {
  return directory === '' ? 0 : directory.split('/').length;
}

function isInScope(directory: string, packageFile: string): boolean {
  return directory === '' || packageFile.startsWith(`${directory}/`);
}

function getSources(
  packageFiles: Record<string, PackageFile[]>,
): SharedConstraintsSource[] {
  const sources: SharedConstraintsSource[] = [];
  for (const [manager, files] of Object.entries(packageFiles)) {
    for (const {
      packageFile,
      extractedConstraints,
      sharedConstraintsScope: scope,
    } of files) {
      if (scope && isNonEmptyObject(extractedConstraints)) {
        sources.push({
          ...scope,
          manager,
          packageFile,
          constraints: extractedConstraints,
        });
      }
    }
  }
  return sources;
}

/**
 * Collects the `extractedConstraints` which managers like `mise` share, merged per manager and directory by their precedence, shallower directories first.
 */
export function collectSharedConstraints(
  packageFiles: Record<string, PackageFile[]> | undefined,
): SharedConstraints[] {
  // `extractAllDependencies` may have yielded nothing
  const sources = getSources(coerceObject(packageFiles)).sort(
    (a, b) =>
      a.precedence - b.precedence || a.packageFile.localeCompare(b.packageFile),
  );

  const shared = new Map<string, SharedConstraints>();
  for (const { manager, directory, constraints } of sources) {
    const key = `${manager}:${directory}`;
    const entry = shared.get(key) ?? { manager, directory, constraints: {} };
    // the lower precedence comes first, so the higher one wins
    entry.constraints = { ...entry.constraints, ...constraints };
    shared.set(key, entry);
  }
  return [...shared.values()].sort(
    (a, b) => getDepth(a.directory) - getDepth(b.directory),
  );
}

/**
 * Returns the shared constraints which apply to a package file of `manager`, the nearest directory winning.
 *
 * The constraints which a manager shares do not apply to its own package files.
 */
export function getSharedConstraints(
  sharedConstraints: SharedConstraints[] | undefined,
  manager: string | undefined,
  packageFile: string | undefined,
): Partial<Record<ConstraintName, string>> {
  const constraints: Partial<Record<ConstraintName, string>> = {};
  for (const shared of coerceArray(sharedConstraints)) {
    if (
      shared.manager !== manager &&
      isInScope(shared.directory, packageFile ?? '')
    ) {
      Object.assign(constraints, shared.constraints);
    }
  }
  return constraints;
}
