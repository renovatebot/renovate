import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';
export { getRangeStrategy } from './range';
export { updateDependency } from './update';

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['flake.lock'];
export const lockFileMaintenanceIsDelegatedToPackageManager = true;

export const url = 'https://nix.dev';

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)flake\\.nix$/'],
  enabled: false,
};

export const supportedDatasources = [GitRefsDatasource.id];
