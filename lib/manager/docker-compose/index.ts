import { ProgrammingLanguage } from '../../constants';
import * as datasourceDocker from '../../datasource/docker';
import { extractPackageFile } from './extract';

const language = ProgrammingLanguage.Docker;

export { extractPackageFile, language };

export const defaultConfig = {
  fileMatch: ['(^|/)docker-compose[^/]*\\.ya?ml$'],
};

export const supportedDatasources = [datasourceDocker.id];
