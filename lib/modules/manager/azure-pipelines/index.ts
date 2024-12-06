import type { Category } from '../../../constants';
import { AzurePipelinesTasksDatasource } from '../../datasource/azure-pipelines-tasks';
import { GitTagsDatasource } from '../../datasource/git-tags';
export { extractPackageFile } from './extract';

export const url = 'https://learn.microsoft.com/azure/devops/pipelines';
export const categories: Category[] = ['ci'];

export const defaultConfig = {
  fileMatch: ['(^|/).azuredevops/.+\\.ya?ml$', 'azure.*pipelines?.*\\.ya?ml$'],
  enabled: false,
};

export const supportedDatasources = [
  AzurePipelinesTasksDatasource.id,
  GitTagsDatasource.id,
];
