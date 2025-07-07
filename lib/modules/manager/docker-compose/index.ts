import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const url = 'https://docs.docker.com/compose';
export const categories: Category[] = ['docker'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)(?:docker-)?compose[^/]*\\.ya?ml$/'],
};

export const supportedDatasources = [DockerDatasource.id];
