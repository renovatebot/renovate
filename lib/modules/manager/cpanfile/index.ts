import type { Category } from '../../../constants/index.ts';
import { CpanDatasource } from '../../datasource/cpan/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'cpanfile';
export const url =
  'https://metacpan.org/dist/Module-CPANfile/view/lib/cpanfile.pod';
export const categories: Category[] = ['perl'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)cpanfile$/'],
};

export const supportedDatasources = [
  CpanDatasource.id,
  GithubTagsDatasource.id,
];
