import type { Category } from '../../../constants/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'pip setup.py';
export const url =
  'https://pip.pypa.io/en/latest/reference/build-system/setup-py';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)setup\\.py$/'],
};

export const supportedDatasources = [PypiDatasource.id];
