import type { Category } from '../../../constants/index.ts';
import { MavenDatasource } from '../../datasource/maven/index.ts';

export { extractPackageFile } from './extract.ts';

export const url =
  'https://kotlinlang.org/docs/custom-script-deps-tutorial.html';
export const categories: Category[] = ['java'];

export const defaultConfig = {
  managerFilePatterns: ['/^.+\\.main\\.kts$/'],
};

export const supportedDatasources = [MavenDatasource.id];
