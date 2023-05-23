import { JenkinsPluginsDatasource } from '../../datasource/jenkins-plugins';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)plugins\\.(txt|ya?ml)$'],
  filePatterns: ['**/plugins.{txt,yml,yaml}'], // not used yet
};

export const supportedDatasources = [JenkinsPluginsDatasource.id];
