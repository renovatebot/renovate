import { DockerDatasource } from '../../datasource/docker';

export { extractPackageFile } from './extract';

export const displayName = 'Vela';
export const url = 'https://go-vela.github.io/docs/';

export const defaultConfig = {
  fileMatch: ['(^|/)\\.vela\\.ya?ml$'],
  filePatterns: ['**/.vela.{yml,yaml}'], // not used yet
};

export const supportedDatasources = [DockerDatasource.id];
