import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const url = 'https://docs.drone.io';
export const categories: Category[] = ['ci'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.drone\\.yml$/'],
};

export const supportedDatasources = [DockerDatasource.id];
