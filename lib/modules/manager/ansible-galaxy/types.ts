import type { PackageDependency } from '../types.ts';
import type { AnsibleGalaxyDepType } from './dep-types.ts';

export type AnsibleGalaxyPackageDependency = Omit<
  PackageDependency<Record<string, any>, AnsibleGalaxyDepType>,
  'managerData'
> &
  Required<Pick<PackageDependency<Record<string, any>, AnsibleGalaxyDepType>, 'managerData'>>;
