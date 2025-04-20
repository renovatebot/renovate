import type { Package, PackageRepository } from './schema';

export interface GlasskubeResources {
  packageFile: string;
  packages: Package[];
  repositories: PackageRepository[];
}
