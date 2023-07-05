import type { Category } from '../../../constants';
import { MavenDatasource } from '../../datasource/maven';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['^.+\\.main\\.kts$'],
};

export const categories: Category[] = ['java'];

export const supportedDatasources = [MavenDatasource.id];
