import type { Category } from '../../../constants';
import { PypiDatasource } from '../../datasource/pypi';
export { bumpPackageVersion } from './update';
export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const supportsLockFileMaintenance = true;

export const displayName = 'PEP 621';
export const url = 'https://peps.python.org/pep-0621';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)pyproject\\.toml$/'],
};

export const supportedDatasources = [PypiDatasource.id];
