import { GitTagsDatasource } from '../../datasource/git-tags';
export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';

export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  fileMatch: ['(^|/)jsonnetfile\\.json$'],
  datasource: GitTagsDatasource.id,
};

export const supportedDatasources = [GitTagsDatasource.id];
