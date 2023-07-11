import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['^\\.woodpecker(?:/[^/]+)?\\.ya?ml$'],
};

export const categories: Category[] = ['ci'];

export const supportedDatasources = [DockerDatasource.id];
