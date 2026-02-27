import { DevboxDatasource } from '../../datasource/devbox/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['devbox.lock'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)devbox\\.json$/'],
};

export const supportedDatasources = [DevboxDatasource.id];
