import type { Category } from '../../../constants';
import { AzurePipelinesTasksDatasource } from '../../datasource/azure-pipelines-tasks';
import { GitTagsDatasource } from '../../datasource/git-tags';
import type { ExtractConfig } from '../types';
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

export interface AzurePipelinesExtractConfig extends ExtractConfig {
  repository: string | undefined;
}
