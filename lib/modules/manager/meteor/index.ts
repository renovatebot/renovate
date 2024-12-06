import type { Category } from '../../../constants';
import { NpmDatasource } from '../../datasource/npm';

export { extractPackageFile } from './extract';

export const url = 'https://docs.meteor.com';
export const categories: Category[] = ['js'];

export const defaultConfig = {
  fileMatch: ['(^|/)package\\.js$'],
};

export const supportedDatasources = [NpmDatasource.id];
