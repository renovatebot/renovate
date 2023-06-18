import type { ProgrammingLanguage } from '../../../constants';
import { DotnetVersionDatasource } from '../../datasource/dotnet-version';
import { NugetDatasource } from '../../datasource/nuget';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';
export { bumpPackageVersion } from './update';

export const language: ProgrammingLanguage = 'dotnet';

export const defaultConfig = {
  fileMatch: [
    '\\.(?:cs|fs|vb)proj$',
    '\\.(?:props|targets)$',
    '(^|/)dotnet-tools\\.json$',
    '(^|/)global\\.json$',
  ],
};

export const supportedDatasources = [
  DotnetVersionDatasource.id,
  NugetDatasource.id,
];
