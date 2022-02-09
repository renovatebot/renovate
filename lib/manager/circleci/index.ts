import * as datasourceDocker from '../../datasource/docker';
import { OrbDatasource } from '../../datasource/orb';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/).circleci/config.yml$'],
};

export const supportedDatasources = [datasourceDocker.id, OrbDatasource.id];
