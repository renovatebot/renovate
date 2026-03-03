import type { Category } from '../../../constants/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';

export { extractPackageFile } from './extract.ts';

export const url = 'https://crowci.dev';
export const categories: Category[] = ['ci'];

export const defaultConfig = {
  managerFilePatterns: ['/^\\.crow(?:/[^/]+)?\\.ya?ml$/'],
};

export const supportedDatasources = [DockerDatasource.id];
