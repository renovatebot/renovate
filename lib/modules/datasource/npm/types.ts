import type { PackageRule } from '../../../config/types.ts';
import type { HostRule } from '../../../types/index.ts';

export interface NpmrcRules {
  hostRules: HostRule[];
  packageRules: PackageRule[];
}
