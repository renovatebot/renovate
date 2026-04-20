import type { Category } from '../../../constants/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['jsonnetfile.lock.json'];

export const displayName = 'jsonnet-bundler';
export const url = 'https://github.com/jsonnet-bundler/jsonnet-bundler#readme';
export const categories: Category[] = ['kubernetes'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)jsonnetfile\\.json$/'],
  datasource: GitTagsDatasource.id,
};

export const supportedDatasources = [GitTagsDatasource.id];
