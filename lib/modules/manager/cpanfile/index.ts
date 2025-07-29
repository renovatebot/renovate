import type { Category } from '../../../constants';
import { CpanDatasource } from '../../datasource/cpan';
import { GithubTagsDatasource } from '../../datasource/github-tags';

export { extractPackageFile } from './extract';

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
