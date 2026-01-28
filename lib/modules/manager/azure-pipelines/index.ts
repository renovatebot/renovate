import type { Category } from '../../../constants/index.ts';
import { AzurePipelinesTasksDatasource } from '../../datasource/azure-pipelines-tasks/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';

export { extractPackageFile } from './extract.ts';

export const url = 'https://learn.microsoft.com/azure/devops/pipelines';
export const categories: Category[] = ['ci'];

export const defaultConfig = {
  managerFilePatterns: [
    '/(^|/).azuredevops/.+\\.ya?ml$/',
    '/azure.*pipelines?.*\\.ya?ml$/',
  ],
  enabled: false,
};

export const supportedDatasources = [
  AzurePipelinesTasksDatasource.id,
  GitTagsDatasource.id,
];
