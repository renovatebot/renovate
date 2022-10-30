import { GitRefsDatasource } from '../../datasource/git-refs';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  fileMatch: ['(^|\\/)flake\\.nix$'],
  enabled: false,
};

export const supportedDatasources = [GitRefsDatasource.id];
