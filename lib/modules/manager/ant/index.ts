import type { Category } from '../../../constants/index.ts';
import { MavenDatasource } from '../../datasource/maven/index.ts';

export { extractAllPackageFiles, extractPackageFile } from './extract.ts';

export const displayName = 'Apache Ant';
export const url = 'https://ant.apache.org/';
export const categories: Category[] = ['java'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)build\\.xml$/'],
};

export const supportedDatasources = [MavenDatasource.id];
