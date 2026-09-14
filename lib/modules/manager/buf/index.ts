import type { Category } from '../../../constants/index.ts';
import { BufModuleDatasource } from '../../datasource/buf-module/index.ts';
import { BufPluginDatasource } from '../../datasource/buf-plugin/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractAllPackageFiles, extractPackageFile } from './extract.ts';

export const url = 'https://buf.build/docs/generate/overview';

export const categories: Category[] = ['buf'];

export const supportsLockFileMaintenance = true;

// `buf dep update` refreshes every dependency in buf.lock at once.
export const lockFileMaintenanceIsDelegatedToPackageManager = true;

export const lockFileNames = ['buf.lock'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)buf\\.gen\\.ya?ml$/', '/(^|/)buf\\.ya?ml$/'],
};

export const supportedDatasources = [
  BufModuleDatasource.id,
  BufPluginDatasource.id,
];
