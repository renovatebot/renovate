import type { Category } from '../../../constants/index.ts';
import { GiteaTagsDatasource } from '../../datasource/gitea-tags/index.ts';
import { GithubDigestDatasource } from '../../datasource/github-digest/index.ts';
import { GithubRunnersDatasource } from '../../datasource/github-runners/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';

export { extractPackageFile } from './extract.ts';

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
