import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
export { extractPackageFile } from './extract';

export const name = 'Dev Container';
export const url =
  'https://code.visualstudio.com/docs/devcontainers/containers';
export const categories: Category[] = ['docker'];

export const defaultConfig = {
  fileMatch: ['^.devcontainer/devcontainer.json$', '^.devcontainer.json$'],
};

export const supportedDatasources = [DockerDatasource.id];
