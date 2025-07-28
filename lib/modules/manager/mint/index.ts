import type { Category } from '../../../constants';
import { GitTagsDatasource } from '../../datasource/git-tags';

export { extractPackageFile } from './extract';

export const url = 'https://github.com/yonaskolb/Mint#readme';
export const categories: Category[] = ['swift'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)Mintfile$/'],
};

export const supportedDatasources = [GitTagsDatasource.id];
