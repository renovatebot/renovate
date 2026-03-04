import type { Package, PackageRepository } from './schema.ts';

export interface GlasskubeResources {
  packageFile: string;
  packages: Package[];
  repositories: PackageRepository[];
}
