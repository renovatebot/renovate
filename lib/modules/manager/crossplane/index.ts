import type { Category } from '../../../constants/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';

export { extractPackageFile } from './extract.ts';

export const url = 'https://docs.crossplane.io';

export const defaultConfig = {
  managerFilePatterns: [],
};

export const categories: Category[] = ['kubernetes', 'iac'];

export const supportedDatasources = [DockerDatasource.id];
