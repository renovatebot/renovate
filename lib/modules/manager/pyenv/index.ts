import type { Category } from '../../../constants/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import * as dockerVersioning from '../../versioning/docker/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'pyenv';
export const url = 'https://github.com/pyenv/pyenv#readme';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.python-version$/'],
  versioning: dockerVersioning.id,
  pinDigests: false,
};

export const supportedDatasources = [DockerDatasource.id];
