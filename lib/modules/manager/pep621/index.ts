import type { Category } from '../../../constants';
import { PypiDatasource } from '../../datasource/pypi';
export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const supportedDatasources = [PypiDatasource.id];

export const supportsLockFileMaintenance = true;

export const categories: Category[] = ['python'];

export const defaultConfig = {
  fileMatch: ['(^|/)pyproject\\.toml$'],
};
