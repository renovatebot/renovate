import type { Category } from '../../../constants/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { DotnetVersionDatasource } from '../../datasource/dotnet-version/index.ts';
import { NugetDatasource } from '../../datasource/nuget/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';
export { bumpPackageVersion } from './update.ts';

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['packages.lock.json'];

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
  // after Renovate 43.208.2, this is required to make sure that NuGet's treatment of "bare versions" as a range does not lead to a lack of dependency updates
  // NOTE that in the next major version, this will be removed, and users will need to decide whether to re-enable this
  rangeStrategy: 'bump',
};

export const supportedDatasources = [
  DockerDatasource.id,
  DotnetVersionDatasource.id,
  NugetDatasource.id,
];

export { knownDepTypes } from './dep-types.ts';
