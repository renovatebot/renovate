import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
export { extractPackageFile } from './extract';

export const url = 'https://crowci.dev';
export const categories: Category[] = ['ci'];

export const defaultConfig = {
  managerFilePatterns: ['/^\\.crow(?:/[^/]+)?\\.ya?ml$/'],
};

export const supportedDatasources = [DockerDatasource.id];
