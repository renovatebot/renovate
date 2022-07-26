import { ProgrammingLanguage } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { extractAllPackageFiles, extractPackageFile } from './extract';

export const language = ProgrammingLanguage.Docker;

export { extractAllPackageFiles, extractPackageFile };

export const defaultConfig = {
  fileMatch: ['\\.gitlab-ci\\.yml$'],
};

export const supportedDatasources = [DockerDatasource.id];
