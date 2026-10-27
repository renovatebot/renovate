import { isNonEmptyObject } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { get } from '../../../modules/manager/index.ts';
import type {
  PackageFile,
  SharedConstraintsScope,
} from '../../../modules/manager/types.ts';
import type { ConstraintName } from '../../../util/exec/types.ts';
import { coerceObject } from '../../../util/object.ts';

interface SharedConstraints extends SharedConstraintsScope {
  manager: string;
  packageFile: string;
  depth: number;
  constraints: Partial<Record<ConstraintName, string>>;
}

function getDepth(directory: string): number {
  return directory === '' ? 0 : directory.split('/').length;
}

function isInScope(directory: string, packageFile: string): boolean {
  return directory === '' || packageFile.startsWith(`${directory}/`);
}

/**
 * Collects the constraints of the managers which share them, lowest precedence first: shallower directories before deeper ones, then by the precedence within a directory.
 */
function collectSharedConstraints(
  packageFiles: Record<string, PackageFile[]>,
): SharedConstraints[] {
  const shared: SharedConstraints[] = [];
  for (const [manager, files] of Object.entries(packageFiles)) {
    const getScope = get(manager, 'getSharedConstraintsScope');
    if (!getScope) {
      continue;
    }
    for (const { packageFile, extractedConstraints } of files) {
      const scope = getScope(packageFile);
      if (scope && isNonEmptyObject(extractedConstraints)) {
        shared.push({
          ...scope,
          manager,
          packageFile,
          depth: getDepth(scope.directory),
          constraints: extractedConstraints,
        });
      }
    }
  }
  return shared.sort(
    (a, b) =>
      a.depth - b.depth ||
      a.precedence - b.precedence ||
      a.packageFile.localeCompare(b.packageFile),
  );
}

/**
 * Adds the `extractedConstraints` which managers like `mise` share to the package files of other managers in the same directory or below.
 *
 * The constraints which a package file extracted itself win, and of the shared ones those of the nearest directory win.
 */
export function applySharedConstraints(
  packageFiles: Record<string, PackageFile[]> | undefined,
): void {
  // `extractAllDependencies` may have yielded nothing
  const allPackageFiles = coerceObject(packageFiles);
  const shared = collectSharedConstraints(allPackageFiles);
  if (!shared.length) {
    return;
  }

  for (const [manager, files] of Object.entries(allPackageFiles)) {
    for (const file of files) {
      const applicable = shared.filter(
        (source) =>
          source.manager !== manager &&
          isInScope(source.directory, file.packageFile),
      );
      if (!applicable.length) {
        continue;
      }

      const constraints: Partial<Record<ConstraintName, string>> = {};
      for (const source of applicable) {
        Object.assign(constraints, source.constraints);
      }
      logger.debug(
        `Using constraints of ${applicable.map((source) => source.packageFile).join(', ')} for ${file.packageFile}`,
      );
      // a new object, so the constraints of other package files are not changed
      file.extractedConstraints = {
        ...constraints,
        ...file.extractedConstraints,
      };
    }
  }
}
