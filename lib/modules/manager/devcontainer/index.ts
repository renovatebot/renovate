import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['^.devcontainer/devcontainer.json$', '^.devcontainer.json$'],
};

export const categories: Category[] = ['docker'];

export const supportedDatasources = [DockerDatasource.id];
