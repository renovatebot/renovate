import { AzurePipelinesTasksDatasource } from '../../datasource/azure-pipelines-tasks';
import { GitTagsDatasource } from '../../datasource/git-tags';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['azure.*pipelines?.*\\.ya?ml$'],
};

export const supportedDatasources = [
  AzurePipelinesTasksDatasource.id,
  GitTagsDatasource.id,
];
