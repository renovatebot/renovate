import { DevboxDatasource } from '../../datasource/devbox';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  fileMatch: ['(^|/)devbox\\.json$'],
};

export const supportedDatasources = [DevboxDatasource.id];
