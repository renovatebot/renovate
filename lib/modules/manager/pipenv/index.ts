import type { Category } from '../../../constants';
import { PypiDatasource } from '../../datasource/pypi';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const supportsLockFileMaintenance = true;

export const url = 'https://pipenv.pypa.io/en/latest';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  fileMatch: ['(^|/)Pipfile$'],
};

export const supportedDatasources = [PypiDatasource.id];
