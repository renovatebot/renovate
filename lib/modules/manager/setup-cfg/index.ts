import type { Category } from '../../../constants';
import { PypiDatasource } from '../../datasource/pypi';
import { id as versioning } from '../../versioning/pep440';

export { extractPackageFile } from './extract';

export const supportedDatasources = [PypiDatasource.id];

export const defaultConfig = {
  fileMatch: ['(^|/)setup\\.cfg$'],
  versioning,
};

export const categories: Category[] = ['python'];
