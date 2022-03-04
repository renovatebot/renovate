import { GitTagsDatasource } from '../../datasource/git-tags';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['azure.*pipelines?.*\\.ya?ml$'],
};

export const supportedDatasources = [GitTagsDatasource.id];
