import type { Category } from '../../../constants';
import { NugetDatasource } from '../../datasource/nuget';
import type {
  PackageDependency,
  PackageFileContent,
  UpdateArtifact,
  UpdateArtifactsResult,
} from '../types';

export const displayName = 'Paket';
export const url = 'https://fsprojects.github.io/Paket/';
export const categories: Category[] = ['dotnet'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)paket\\.dependencies$/'],
};

export const supportedDatasources = [NugetDatasource.id];

export function extractPackageFile(content: string): PackageFileContent {
  const deps: PackageDependency[] = [];
  return {
    deps,
  };
}

export const supportsLockFileMaintenance = true;
export function updateArtifacts(
  command: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  return Promise.resolve([]);
}
