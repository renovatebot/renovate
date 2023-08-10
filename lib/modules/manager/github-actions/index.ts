import type { Category } from '../../../constants';
import { GithubRunnersDatasource } from '../../datasource/github-runners';
import { GithubTagsDatasource } from '../../datasource/github-tags';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: [
    '^(workflow-templates|\\.github/workflows)/[^/]+\\.ya?ml$',
    '(^|/)action\\.ya?ml$',
  ],
};

export const categories: Category[] = ['ci'];

export const supportedDatasources = [
  GithubTagsDatasource.id,
  GithubRunnersDatasource.id,
];
