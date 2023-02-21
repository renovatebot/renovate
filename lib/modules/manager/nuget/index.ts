import type { Category } from '../../../constants';
import { DotnetVersionDatasource } from '../../datasource/dotnet-version';
import { NugetDatasource } from '../../datasource/nuget';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';
export { bumpPackageVersion } from './update';

export const defaultConfig = {
  fileMatch: [
    '\\.(?:cs|fs|vb)proj$',
    '\\.(?:props|targets)$',
    '(^|/)dotnet-tools\\.json$',
    '(^|/)global\\.json$',
  ],
};

export const categories: Category[] = ['dotnet'];

export const supportedDatasources = [
  DotnetVersionDatasource.id,
  NugetDatasource.id,
];
