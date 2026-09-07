import type { Category } from '../../../constants/index.ts';
import type { DatasourceName } from '../../../datasource-list.generated.ts';
import { CpanDatasource } from '../../datasource/cpan/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';

export { knownDepTypes } from './dep-types.ts';
export { extractPackageFile } from './extract.ts';

export const displayName = 'cpanfile';
export const url =
  'https://metacpan.org/dist/Module-CPANfile/view/lib/cpanfile.pod';
export const categories: Category[] = ['perl'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)cpanfile$/'],
};

export const supportedDatasources: DatasourceName[] = [
  CpanDatasource.id,
  GithubTagsDatasource.id,
];
