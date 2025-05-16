import type { Category } from '../../../constants';
import { MavenDatasource } from '../../datasource/maven';

export { extractPackageFile } from './extract';

export const url =
  'https://kotlinlang.org/docs/custom-script-deps-tutorial.html';
export const categories: Category[] = ['java'];

export const defaultConfig = {
  managerFilePatterns: ['/^.+\\.main\\.kts$/'],
};

export const supportedDatasources = [MavenDatasource.id];
