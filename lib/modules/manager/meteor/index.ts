import type { Category } from '../../../constants/index.ts';
import type { DatasourceName } from '../../../datasource-list.generated.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';

export { extractPackageFile } from './extract.ts';

export const url = 'https://docs.meteor.com';
export const categories: Category[] = ['js'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)package\\.js$/'],
};

export const supportedDatasources: DatasourceName[] = [NpmDatasource.id];
