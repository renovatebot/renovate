import { GitRefsDatasource } from '../../datasource/git-refs';

export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';
//export { getRangeStrategy } from './range';
export { updateDependency } from './update';

export const supportedDatasources = [GitRefsDatasource.id];
export const supportsLockFileMaintenance = true;
export const url = 'https://nix.dev';

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)flake\\.nix$/'],
  enabled: false,
};
