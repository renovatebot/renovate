import type { Category } from '../../../constants/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { DotnetVersionDatasource } from '../../datasource/dotnet-version/index.ts';
import { NugetDatasource } from '../../datasource/nuget/index.ts';

export { extractPackageFile } from './extract.ts';
export { updateArtifacts } from './artifacts.ts';
export { bumpPackageVersion } from './update.ts';

export const displayName = 'NuGet';
export const url = 'https://learn.microsoft.com/nuget';
export const categories: Category[] = ['dotnet'];

export const defaultConfig = {
  managerFilePatterns: [
    '/\\.(?:cs|fs|vb)proj$/',
    '/\\.(?:props|targets)$/',
    '/(^|/)dotnet-tools\\.json$/',
    '/(^|/)global\\.json$/',
  ],
};

export const supportedDatasources = [
  DockerDatasource.id,
  DotnetVersionDatasource.id,
  NugetDatasource.id,
];
