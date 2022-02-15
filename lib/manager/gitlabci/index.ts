import { ProgrammingLanguage } from '../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { extractAllPackageFiles, extractPackageFile } from './extract';

const language = ProgrammingLanguage.Docker;

export { extractAllPackageFiles, extractPackageFile, language };

export const defaultConfig = {
  fileMatch: ['\\.gitlab-ci\\.yml$'],
};

export const supportedDatasources = [DockerDatasource.id];
