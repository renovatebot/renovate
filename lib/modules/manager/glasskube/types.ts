import type { Package, PackageRepository } from './schema';

export type GlasskubeResources = {
  packageFile: string;
  packages: Package[];
  repositories: PackageRepository[];
};
