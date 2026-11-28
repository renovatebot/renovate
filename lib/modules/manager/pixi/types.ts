import type { PackageDependency } from '../types.ts';

export interface UpdatePixiLockfile {
  packageFileName: string;
  /** Defaults to the `pixi.lock` next to `packageFileName`. */
  lockFileName?: string;
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

export interface PixiLockFile {
  lockFileName: string;
  /** Whether `lockFileName` is in a parent directory of the package file. */
  isParent: boolean;
  /** `requires-pixi` of the parent workspace manifest. */
  requiresPixi?: string;
}
