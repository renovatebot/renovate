import { DockerDatasource } from '../../datasource/docker';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)\\.?bitbucket-pipelines\\.ya?ml$'],
  filePatterns: [
    '**/bitbucket-pipelines.{yml,yaml}',
    '**/.bitbucket-pipelines.{yml,yaml}',
  ], // not used yet
};

export const supportedDatasources = [DockerDatasource.id];

export const urls = [
  'https://support.atlassian.com/bitbucket-cloud/docs/bitbucket-pipelines-configuration-reference/',
];
