import { Category } from '../../../constants';
import { JenkinsPluginsDatasource } from '../../datasource/jenkins-plugins';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)plugins\\.(txt|ya?ml)$'],
};

export const categories = [Category.CI];

export const supportedDatasources = [JenkinsPluginsDatasource.id];
