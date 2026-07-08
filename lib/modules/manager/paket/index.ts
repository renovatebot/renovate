import type { Category } from '../../../constants/index.ts';
import { NugetDatasource } from '../../datasource/nuget/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';
export { getRangeStrategy } from './range.ts';
export { updateLockedDependency } from './update-locked.ts';

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['paket.lock'];

export const url = 'https://fsprojects.github.io/Paket/';
export const categories: Category[] = ['dotnet'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)paket\\.dependencies$/'],
  // `versioning` is intentionally unset: locked versions compare fine with the
  // nuget datasource default, while Paket constraint syntax needs a dedicated
  // versioning module (see the `unsupported-version` skip in extract.ts)
};

export const supportedDatasources = [NugetDatasource.id];
