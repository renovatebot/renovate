import type { PackageDependency } from '../types.ts';

export interface UpdatePixiLockfile {
  packageFileName: string;
  updatedDeps: PackageDependency[] | undefined;
  isLockFileMaintenance: boolean | undefined;
  /** `pixi` version constraint passed to the tool installer. */
  constraint: string | undefined;
  /**
   * When set, the content is written to `packageFileName` before running
   * `pixi lock`. Callers that have already written the package file to disk
   * (e.g. the `pep621` manager) should leave this `undefined`.
   */
  newPackageFileContent?: string;
}
