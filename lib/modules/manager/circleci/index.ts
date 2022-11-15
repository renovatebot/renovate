import { DockerDatasource } from '../../datasource/docker';
import { OrbDatasource } from '../../datasource/orb';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const displayName = 'CircleCI';
export const url = 'https://circleci.com/docs/configuration-reference';

export const defaultConfig = {
  fileMatch: ['(^|/)\\.circleci/config\\.yml$'],
};

export const supportedDatasources = [DockerDatasource.id, OrbDatasource.id];
