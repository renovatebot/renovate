import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';

export { extractAllPackageFiles } from './extract.ts';
export { updateArtifacts } from './lock.ts';
export { updateDependency } from './update.ts';

export const displayName = 'KAS';
export const supportsLockFileMaintenance = true;
// kas lockfiles live next to their kas file as `<name>.lock.<ext>`
export const lockFileNames = ['*.lock.yml', '*.lock.yaml', '*.lock.json'];
export const lockFileMaintenanceIsDelegatedToPackageManager = false;
export const url = 'https://kas.readthedocs.io/en/latest/';

export const defaultConfig = {
  commitMessageTopic: 'KAS',
  commitMessageExtra: 'to {{newValue}}',
  managerFilePatterns: [],
  enabled: false,
};

export const supportedDatasources = [
  GitRefsDatasource.id,
  GitTagsDatasource.id,
];
