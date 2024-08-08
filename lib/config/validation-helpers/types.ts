import type { PackageRule } from '../types';

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
  baseBranches?: string[];
}
