import type { Category } from '../../../constants';
import { NixhubDatasource } from '../../datasource/nixhub';
import { NodeVersionDatasource } from '../../datasource/node-version';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const supportsLockFileMaintenance = false; // not yet

export const defaultConfig = {
  fileMatch: ['(^|/)devbox\\.json$'],
  commitMessageTopic: 'devbox/{{depName}}',
  commitMessageExtra: 'to {{newValue}}',
  enabled: true,
};

export const categories: Category[] = ['devbox', 'node'];

export const supportedDatasources = [
  NixhubDatasource.id,
  NodeVersionDatasource.id,
];
