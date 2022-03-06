import { DockerDatasource } from '../../datasource/docker';
import { OrbDatasource } from '../../datasource/orb';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/).circleci/config.yml$'],
};

export const supportedDatasources = [DockerDatasource.id, OrbDatasource.id];
