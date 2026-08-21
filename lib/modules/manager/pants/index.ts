import type { Category } from '../../../constants/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';

export { extractAllPackageFiles, extractPackageFile } from './extract.ts';

export const displayName = 'Pants';
export const url = 'https://www.pantsbuild.org/stable/docs/python';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  // Pants' own default `build_patterns`: `BUILD` and `BUILD.*`.
  managerFilePatterns: ['/(^|/)BUILD(\\.[^/]+)?$/'],
};

export const supportedDatasources = [PypiDatasource.id, GitTagsDatasource.id];
