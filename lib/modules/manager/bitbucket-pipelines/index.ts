import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const url =
  'https://support.atlassian.com/bitbucket-cloud/docs/get-started-with-bitbucket-pipelines';
export const categories: Category[] = ['ci'];
export const urls = [
  'https://support.atlassian.com/bitbucket-cloud/docs/bitbucket-pipelines-configuration-reference',
];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.?bitbucket-pipelines\\.ya?ml$/'],
};

export const supportedDatasources = [DockerDatasource.id];
