import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const url = 'https://woodpecker-ci.org';
export const categories: Category[] = ['ci'];

export const defaultConfig = {
  managerFilePatterns: ['/^\\.woodpecker(?:/[^/]+)?\\.ya?ml$/'],
};

export const supportedDatasources = [DockerDatasource.id];
