import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';
export { getRangeStrategy } from './range.ts';

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['flake.lock'];

export const url = 'https://nix.dev';

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)flake\\.nix$/'],
  commitMessageTopic: 'nix',
  commitMessageExtra: 'to {{newValue}}',
  enabled: false,
};

export const supportedDatasources = [GitRefsDatasource.id];
