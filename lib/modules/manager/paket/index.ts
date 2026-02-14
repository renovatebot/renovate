import type { Category } from '../../../constants/index.ts';
import { NugetDatasource } from '../../datasource/nuget/index.ts';

export { extractPackageFile } from './extract.ts';
export { updateArtifacts } from './update.ts';
export { updateLockedDependency } from './update-lock.ts';

export const displayName = 'Paket';
export const url = 'https://fsprojects.github.io/Paket/';
export const categories: Category[] = ['dotnet'];
export const supportsLockFileMaintenance = true;
export const lockFileNames = ['paket.lock'];

export const defaultConfig = {
  managerFilePatterns: ['**paket.dependencies'],
};

export const supportedDatasources = [NugetDatasource.id];
