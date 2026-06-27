import type { Category } from '../../../constants/index.ts';
import { ElmPackageDatasource } from '../../datasource/elm-package/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'Elm';
export const url = 'https://elm-lang.org';
export const categories: Category[] = ['js'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)elm\\.json$/'],
};

export const supportedDatasources = [
  ElmPackageDatasource.id,
  GithubTagsDatasource.id,
];
