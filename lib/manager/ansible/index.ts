import { ProgrammingLanguage } from '../../constants';
import * as datasourceDocker from '../../datasource/docker';
import extractPackageFile from './extract';

const language = ProgrammingLanguage.Docker;

const supportedDatasources = [datasourceDocker.id];

export { extractPackageFile, language, supportedDatasources };

export const defaultConfig = {
  fileMatch: ['(^|/)tasks/[^/]+\\.ya?ml$'],
};
