import { ProgrammingLanguage } from '../../constants';
import { DockerDatasource } from '../../datasource/docker';
export { extractPackageFile } from './extract';

export const language = ProgrammingLanguage.Docker;

export const defaultConfig = {
  fileMatch: ['(^|/)tasks/[^/]+\\.ya?ml$'],
};

export const supportedDatasources = [DockerDatasource.id];
