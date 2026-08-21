import type { Category } from '../../../constants/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'runtime.txt';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)runtime.txt$/'],
  pinDigests: false,
};

export const supportedDatasources = [DockerDatasource.id];
