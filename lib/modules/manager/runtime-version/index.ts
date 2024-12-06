import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';

export { extractPackageFile } from './extract';

export const displayName = 'runtime.txt';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  fileMatch: ['(^|/)runtime.txt$'],
  pinDigests: false,
};

export const supportedDatasources = [DockerDatasource.id];
