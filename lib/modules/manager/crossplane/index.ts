import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';

export { extractPackageFile } from './extract';

export const url = 'https://docs.crossplane.io';

export const defaultConfig = {
  fileMatch: [],
};

export const categories: Category[] = ['kubernetes', 'iac'];

export const supportedDatasources = [DockerDatasource.id];
