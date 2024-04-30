import type { PackageRule } from '../types';

export interface CheckManagerArgs {
  resolvedRule: PackageRule;
  currentPath: string;
}

export interface CheckMatcherArgs {
  val: unknown[];
  currentPath: string;
}
