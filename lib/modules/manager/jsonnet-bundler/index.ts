import type { Category } from '../../../constants';
import { GitTagsDatasource } from '../../datasource/git-tags';
export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';

export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  fileMatch: ['(^|/)jsonnetfile\\.json$'],
  datasource: GitTagsDatasource.id,
};

export const categories: Category[] = ['kubernetes'];

export const supportedDatasources = [GitTagsDatasource.id];
