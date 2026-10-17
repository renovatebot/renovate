import type { PackageRule } from '../types.ts';

/**
 * Known `topic`s for Config Validation errors.
 *
 * This is particularly important for `Security`, which callers use to decide that a violation must always fail validation.
 */
export const ConfigValidationTopic = {
  Error: 'Configuration Error',
  Warning: 'Configuration Warning',
  Deprecation: 'Deprecation Warning',
  Security: 'Config security error',
} as const;

export type ConfigValidationTopic =
  (typeof ConfigValidationTopic)[keyof typeof ConfigValidationTopic];

export interface CheckManagerArgs {
  resolvedRule: PackageRule;
  currentPath: string;
}

export interface CheckMatcherArgs {
  val: unknown;
  currentPath: string;
}

export interface CheckBaseBranchesArgs {
  resolvedRule: PackageRule;
  currentPath: string;
  /** user configurable base branch patterns*/
  baseBranchPatterns?: string[];
}
