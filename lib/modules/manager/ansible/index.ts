import type { Category } from '../../../constants/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
export { extractPackageFile } from './extract.ts';

export const url = 'https://docs.ansible.com';
export const categories: Category[] = ['ansible', 'iac'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)tasks/[^/]+\\.ya?ml$/'],
};

export const supportedDatasources = [DockerDatasource.id];
