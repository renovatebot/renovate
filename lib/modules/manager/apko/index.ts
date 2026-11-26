import type { Category } from '../../../constants/index.ts';
import { ApkDatasource } from '../../datasource/apk/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';

export const url =
  'https://github.com/chainguard-dev/apko/blob/main/docs/apko_file.md';
export const categories: Category[] = ['docker'];

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['apko.lock.json'];
export const lockFileMaintenanceIsDelegatedToPackageManager = true;

export const supportedDatasources = [ApkDatasource.id];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)apko\\.ya?ml$/'],
};
