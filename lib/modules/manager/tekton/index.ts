import { DockerDatasource } from '../../datasource/docker';
import { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: [],
  filePatterns: [], // not used yet
};

export const supportedDatasources = [DockerDatasource.id];

export { extractPackageFile };
