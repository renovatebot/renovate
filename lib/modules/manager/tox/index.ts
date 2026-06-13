import type { Category } from '../../../constants/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';

export { knownDepTypes, supportsDynamicDepTypesNote } from './dep-types.ts';
export { extractPackageFile } from './extract.ts';

export const url = 'https://tox.wiki/';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)tox\\.toml$/', '/(^|/)pyproject\\.toml$/'],
};

export const supportedDatasources = [PypiDatasource.id];
