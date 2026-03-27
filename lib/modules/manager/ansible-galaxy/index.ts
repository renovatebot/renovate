import type { Category } from '../../../constants/index.ts';
import { GalaxyCollectionDatasource } from '../../datasource/galaxy-collection/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';

export { extractPackageFile } from './extract.ts';

export const url =
  'https://docs.ansible.com/ansible/latest/galaxy/user_guide.html';
export const categories: Category[] = ['ansible', 'iac'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)(galaxy|requirements)(\\.ansible)?\\.ya?ml$/'],
};

export const supportedDatasources = [
  GalaxyCollectionDatasource.id,
  GitTagsDatasource.id,
  GithubTagsDatasource.id,
];
