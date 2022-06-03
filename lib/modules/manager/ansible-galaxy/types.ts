import type { PackageDependency } from '../types';

export type AnsibleGalaxyPackageDependency = Omit<
  PackageDependency,
  'managerData'
> &
  Required<Pick<PackageDependency, 'managerData'>>;
