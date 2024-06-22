import type { Category } from '../../../constants';
import { PypiDatasource } from '../../datasource/pypi';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)setup\\.py$'],
};

export const categories: Category[] = ['python'];

export const supportedDatasources = [PypiDatasource.id];
