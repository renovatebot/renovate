import type { Category } from '../../../constants/index.ts';
import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'Haskell Stack';
export const url = 'https://docs.haskellstack.org';

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)stack(-[^/]+)?\\.yaml$/'],
};

export const categories: Category[] = ['haskell'];

export const supportedDatasources = [GitRefsDatasource.id];
