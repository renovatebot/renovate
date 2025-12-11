import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';

export { extractAllPackageFiles } from './extract.ts';
export { updateDependency } from './update.ts';

export const displayName = 'KAS';
export const supportsLockFileMaintenance = false;
export const url = 'https://kas.readthedocs.io/en/latest/';

export const defaultConfig = {
  commitMessageTopic: 'KAS',
  commitMessageExtra: 'to {{newValue}}',
  enabled: false,
};

export const supportedDatasources = [
  GitRefsDatasource.id,
  GitTagsDatasource.id,
];
