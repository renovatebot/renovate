import type { Category } from '../../../constants';
import { GiteaTagsDatasource } from '../../datasource/gitea-tags';
import { GithubRunnersDatasource } from '../../datasource/github-runners';
import { GithubTagsDatasource } from '../../datasource/github-tags';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: [
    '(^|/)(workflow-templates|\\.(?:github|gitea|forgejo)/(?:workflows|actions))/.+\\.ya?ml$',
    '(^|/)action\\.ya?ml$',
  ],
};

export const categories: Category[] = ['ci'];

export const supportedDatasources = [
  GiteaTagsDatasource.id,
  GithubTagsDatasource.id,
  GithubRunnersDatasource.id,
];
