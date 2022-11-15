import { DockerDatasource } from '../../datasource/docker';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)cloudbuild\\.ya?ml'],
};

export const supportedDatasources = [DockerDatasource.id];
