import type { Category } from '../../../constants';
import { NpmDatasource } from '../../datasource/npm';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)package\\.js$'],
};

export const categories: Category[] = ['js'];

export const supportedDatasources = [NpmDatasource.id];
