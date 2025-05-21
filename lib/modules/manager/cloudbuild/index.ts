import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const displayName = 'Cloud Build';
export const url = 'https://cloud.google.com/build/docs';
export const categories: Category[] = ['ci'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)cloudbuild\\.ya?ml/'],
};

export const supportedDatasources = [DockerDatasource.id];
