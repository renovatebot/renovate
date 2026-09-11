import type { Category } from '../../../constants/index.ts';
import { NugetDatasource } from '../../datasource/nuget/index.ts';
import * as paketVersioning from '../../versioning/paket/index.ts';

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
  // Releases come from the nuget datasource, but constraints use the paket
  // versioning module: Paket reads a bare `1.2.3` as an exact pin, whereas
  // nuget versioning reads it as a floor (>= 1.2.3).
  versioning: paketVersioning.id,
};

export const supportedDatasources = [NugetDatasource.id];
