import type { Category } from '../../../constants/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';

export const displayName = 'pip Requirements';
export const url =
  'https://pip.pypa.io/en/stable/reference/requirements-file-format';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)[\\w-]*requirements([-.]\\w+)?\\.(txt|pip)$/'],
};

export const supportedDatasources = [PypiDatasource.id, GitTagsDatasource.id];
