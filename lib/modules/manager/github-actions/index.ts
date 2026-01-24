import type { Category } from '../../../constants';
import { GiteaTagsDatasource } from '../../datasource/gitea-tags';
import { GithubDigestDatasource } from '../../datasource/github-digest';
import { GithubRunnersDatasource } from '../../datasource/github-runners';
import { GithubTagsDatasource } from '../../datasource/github-tags';
export { extractPackageFile } from './extract';

export const displayName = 'GitHub Actions';
export const url = 'https://docs.github.com/en/actions';
export const categories: Category[] = ['ci'];

export const defaultConfig = {
  managerFilePatterns: [
    '/(^|/)(workflow-templates|\\.(?:github|gitea|forgejo)/(?:workflows|actions))/.+\\.ya?ml$/',
    '/(^|/)action\\.ya?ml$/',
  ],
};

export const supportedDatasources = [
  GiteaTagsDatasource.id,
  GithubDigestDatasource.id,
  GithubRunnersDatasource.id,
  GithubTagsDatasource.id,
];
