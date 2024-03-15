import { NixhubDatasource } from '../../datasource/nixhub';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const supportsLockFileMaintenance = false; // not yet

export const defaultConfig = {
  fileMatch: ['(^|/)devbox\\.json$'],
  commitMessageTopic: 'devbox/{{depName}}',
  commitMessageExtra: 'to {{newValue}}',
  enabled: true,
};

export const supportedDatasources = [NixhubDatasource.id];
