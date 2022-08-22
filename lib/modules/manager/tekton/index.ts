import { DockerDatasource } from '../../datasource/docker';
import { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: [],
};

export const supportedDatasources = [DockerDatasource.id];

export { extractPackageFile };
