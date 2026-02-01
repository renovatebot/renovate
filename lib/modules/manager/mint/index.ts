import type { Category } from '../../../constants/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';

export { extractPackageFile } from './extract.ts';

export const url = 'https://github.com/yonaskolb/Mint#readme';
export const categories: Category[] = ['swift'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)Mintfile$/'],
};

export const supportedDatasources = [GitTagsDatasource.id];
