import type { PackageDependency } from '../types.ts';

export type AnsibleGalaxyPackageDependency = Omit<
  PackageDependency,
  'managerData'
> &
  Required<Pick<PackageDependency, 'managerData'>>;
