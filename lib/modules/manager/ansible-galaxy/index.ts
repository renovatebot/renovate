import type { Category } from '../../../constants';
import { GalaxyCollectionDatasource } from '../../datasource/galaxy-collection';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';

export { extractPackageFile } from './extract';

export const url =
  'https://docs.ansible.com/ansible/latest/galaxy/user_guide.html';
export const categories: Category[] = ['ansible', 'iac'];

export const defaultConfig = {
  fileMatch: ['(^|/)(galaxy|requirements)(\\.ansible)?\\.ya?ml$'],
};

export const supportedDatasources = [
  GalaxyCollectionDatasource.id,
  GitTagsDatasource.id,
  GithubTagsDatasource.id,
];
