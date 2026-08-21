import type { Category } from '../../../constants/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'Vela';
export const url = 'https://go-vela.github.io/docs';
export const categories: Category[] = ['ci'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.vela\\.ya?ml$/'],
};

export const supportedDatasources = [DockerDatasource.id];
