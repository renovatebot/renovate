import { GitRefsDatasource } from '../../datasource/git-refs';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';
export { updateDependency } from './update';

export const supportsLockFileMaintenance = true;

export const url = 'https://nix.dev';

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)flake\\.nix$/'],
  enabled: false,
};

export const supportedDatasources = [GitRefsDatasource.id];
