import { DevboxDatasource } from '../../datasource/devbox/index.ts';

export { extractPackageFile } from './extract.ts';
export { updateArtifacts } from './artifacts.ts';

export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)devbox\\.json$/'],
};

export const supportedDatasources = [DevboxDatasource.id];
