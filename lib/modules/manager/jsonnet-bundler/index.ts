import type { Category } from '../../../constants';
import { GitTagsDatasource } from '../../datasource/git-tags';
export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';

export const supportsLockFileMaintenance = true;

export const displayName = 'jsonnet-bundler';
export const url = 'https://github.com/jsonnet-bundler/jsonnet-bundler#readme';
export const categories: Category[] = ['kubernetes'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)jsonnetfile\\.json$/'],
  datasource: GitTagsDatasource.id,
};

export const supportedDatasources = [GitTagsDatasource.id];
