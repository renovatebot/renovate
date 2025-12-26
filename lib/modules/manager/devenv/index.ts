import { GitRefsDatasource } from '../../datasource/git-refs';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';
export { getRangeStrategy } from './range';

export const supportsLockFileMaintenance = true;

export const url = 'https://devenv.sh';

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)devenv\\.nix$/'],
  commitMessageTopic: 'devenv',
  commitMessageExtra: 'to {{newValue}}',
  enabled: false,
};

export const supportedDatasources = [GitRefsDatasource.id];
