import type { PackageDependency } from '../types.ts';

export interface GenericImageResourceDef {
  type: string;
  path: string[];
}

export interface ExtractionResult<T = Record<string, any>> {
  lineNumber: number;
  dependencies: PackageDependency<T>[];
}

/**
 * Fills in `dep` from a Git module source and returns `true`, or returns
 * `false` when the source is not of the handled kind.
 */
export type GitSourceMatcher = (
  dep: PackageDependency,
  source: string,
) => boolean;

export interface ModuleSourceOptions {
  /** Manager name, used in debug logs. */
  manager: string;

  /**
   * `depType` to set per matched source kind. Managers which assign a single
   * `depType` upfront, like `terraform`, leave this undefined.
   */
  depTypes?: {
    github: string;
    registry: string;
  };

  /** Handles Git sources which are not GitHub refs. */
  matchGitSource?: GitSourceMatcher;
}
