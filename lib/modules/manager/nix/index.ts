import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';
export { updateDependency } from './update.ts';

export const supportedDatasources = [GitRefsDatasource.id];
export const supportsLockFileMaintenance = true;
export const url = 'https://nix.dev';

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)flake\\.nix$/'],
  enabled: false,
};
