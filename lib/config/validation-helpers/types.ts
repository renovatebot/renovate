import { PackageRule } from '../types';

export interface CheckManagerArgs {
  resolvedRule: PackageRule;
  currentPath: string;
}
