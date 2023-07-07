import type { Category } from '../../../constants';
import { AzurePipelinesTasksDatasource } from '../../datasource/azure-pipelines-tasks';
import { GitTagsDatasource } from '../../datasource/git-tags';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['azure.*pipelines?.*\\.ya?ml$'],
  enabled: false,
};

export const categories: Category[] = ['ci'];

export const supportedDatasources = [
  AzurePipelinesTasksDatasource.id,
  GitTagsDatasource.id,
];
