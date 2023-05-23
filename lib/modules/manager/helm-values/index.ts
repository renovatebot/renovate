import { DockerDatasource } from '../../datasource/docker';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  commitMessageTopic: 'helm values {{depName}}',
  fileMatch: ['(^|/)values\\.ya?ml$'],
  filePatterns: ['**/values.{yml,yaml}'], // not used yet
  pinDigests: false,
};

export const supportedDatasources = [DockerDatasource.id];
