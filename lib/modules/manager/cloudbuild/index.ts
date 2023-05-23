import { DockerDatasource } from '../../datasource/docker';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)cloudbuild\\.ya?ml'],
  filePatterns: ['**/cloudbuild.{yml,yaml}'], // not used yet
};

export const supportedDatasources = [DockerDatasource.id];
