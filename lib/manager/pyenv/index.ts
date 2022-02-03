import { ProgrammingLanguage } from '../../constants';
import * as datasourceDocker from '../../datasource/docker';
import * as dockerVersioning from '../../versioning/docker';

export { extractPackageFile } from './extract';

export const language = ProgrammingLanguage.Python;

export const supportedDatasources = [datasourceDocker.id];

export const defaultConfig = {
  fileMatch: ['(^|/).python-version$'],
  versioning: dockerVersioning.id,
};
