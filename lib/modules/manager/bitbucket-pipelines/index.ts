import type { ProgrammingLanguage } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { extractPackageFile } from './extract';

export const language: ProgrammingLanguage = 'docker';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)\\.?bitbucket-pipelines\\.ya?ml$'],
};

export const supportedDatasources = [DockerDatasource.id];
