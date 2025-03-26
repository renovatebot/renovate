import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { DotnetVersionDatasource } from '../../datasource/dotnet-version';
import { NugetDatasource } from '../../datasource/nuget';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';
export { bumpPackageVersion } from './update';

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
