import type { Category } from '../../../constants/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { extractPackageFile } from './extract.ts';

export { extractPackageFile };

export const url = 'https://docs.docker.com/compose';
export const categories: Category[] = ['docker'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)(?:docker-)?compose[^/]*\\.ya?ml$/'],
};

export const supportedDatasources = [DockerDatasource.id];
