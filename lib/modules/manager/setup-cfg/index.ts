import type { Category } from '../../../constants';
import { PypiDatasource } from '../../datasource/pypi';
import { id as versioning } from '../../versioning/pep440';

export { extractPackageFile } from './extract';

export const displayName = 'Setuptools (setup.cfg)';
export const url =
  'https://setuptools.pypa.io/en/latest/userguide/declarative_config.html';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)setup\\.cfg$/'],
  versioning,
};

export const supportedDatasources = [PypiDatasource.id];
