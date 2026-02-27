import type { Category } from '../../../constants/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';
export { bumpPackageVersion } from './update.ts';

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['pdm.lock', 'uv.lock'];

export const displayName = 'PEP 621';
export const url = 'https://peps.python.org/pep-0621';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)pyproject\\.toml$/'],
};

export const supportedDatasources = [PypiDatasource.id];
