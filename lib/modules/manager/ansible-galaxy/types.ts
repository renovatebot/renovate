import type { PackageDependency } from '../types.ts';

export interface AnsibleGalaxyManagerData {
  name?: string;
  version: string | null;
  type?: string | null;
  source?: string | null;
  scm?: string | null;
  src?: string | null;
  lineNumber?: number;
}

export type AnsibleGalaxyPackageDependency = Omit<
  PackageDependency<AnsibleGalaxyManagerData>,
  'managerData'
> &
  Required<Pick<PackageDependency<AnsibleGalaxyManagerData>, 'managerData'>>;
