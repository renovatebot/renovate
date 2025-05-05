import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import * as dockerVersioning from '../../versioning/docker';

export { extractPackageFile } from './extract';

export const displayName = 'pyenv';
export const url = 'https://github.com/pyenv/pyenv#readme';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.python-version$/'],
  versioning: dockerVersioning.id,
  pinDigests: false,
};

export const supportedDatasources = [DockerDatasource.id];
