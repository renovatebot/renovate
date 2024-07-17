import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';

export { extractPackageFile } from './extract';

export const displayName = 'Runtime Version';

export const defaultConfig = {
  fileMatch: ['(^|/)runtime.txt$'],
  pinDigests: false,
};

export const categories: Category[] = ['python'];

export const supportedDatasources = [DockerDatasource.id];
