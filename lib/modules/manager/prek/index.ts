import type { Category } from '../../../constants/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import { GoDatasource } from '../../datasource/go/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';

export { knownDepTypes } from './dep-types.ts';
export { extractPackageFile } from './extract.ts';

export const displayName = 'prek';
export const url = 'https://prek.j178.dev';
export const categories: Category[] = ['git'];

export const defaultConfig = {
  commitMessageTopic: 'prek hook {{depName}}',
  managerFilePatterns: ['/(^|/)prek\\.toml$/'],
};

export const supportedDatasources = [
  GithubTagsDatasource.id,
  GitlabTagsDatasource.id,
  NpmDatasource.id,
  PypiDatasource.id,
  GoDatasource.id,
];
