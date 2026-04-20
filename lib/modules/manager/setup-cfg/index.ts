import type { Category } from '../../../constants/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';
import { id as versioning } from '../../versioning/pep440/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'Setuptools (setup.cfg)';
export const url =
  'https://setuptools.pypa.io/en/latest/userguide/declarative_config.html';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)setup\\.cfg$/'],
  versioning,
};

export const supportedDatasources = [PypiDatasource.id];
