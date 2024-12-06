import type { Category } from '../../../constants';
import { PypiDatasource } from '../../datasource/pypi';

export { extractPackageFile } from './extract';

export const displayName = 'pip setup.py';
export const url =
  'https://pip.pypa.io/en/latest/reference/build-system/setup-py';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  fileMatch: ['(^|/)setup\\.py$'],
};

export const supportedDatasources = [PypiDatasource.id];
