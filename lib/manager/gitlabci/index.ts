import { ProgrammingLanguage } from '../../constants';
import * as datasourceDocker from '../../datasource/docker';
import { extractAllPackageFiles, extractPackageFile } from './extract';

const language = ProgrammingLanguage.Docker;

export { extractAllPackageFiles, extractPackageFile, language };

export const defaultConfig = {
  fileMatch: ['\\.gitlab-ci\\.yml$'],
};

export const supportedDatasources = [datasourceDocker.id];
