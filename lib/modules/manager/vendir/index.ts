import { HelmDatasource } from '../../datasource/helm';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  commitMessageTopic: 'vendir {{depName}}',
  fileMatch: ['(^|/)vendir\\.yml$'],
};

export const supportedDatasources = [HelmDatasource.id];
export const supportsLockFileMaintenance = true;
