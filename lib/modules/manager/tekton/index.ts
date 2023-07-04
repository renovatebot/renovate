import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: [],
};

export const categories: Category[] = ['ci', 'cd'];

export const supportedDatasources = [DockerDatasource.id];

export { extractPackageFile };
