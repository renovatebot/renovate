import type { Category } from '../../../constants';
import { CarthageDatasource } from '../../datasource/carthage';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import * as carthageVersioning from '../../versioning/carthage';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const displayName = 'Carthage';
export const url = 'https://github.com/Carthage/Carthage';

export const defaultConfig = {
  fileMatch: ['(^|/)Cartfile$'],
  versioning: carthageVersioning.id,
};

export const categories: Category[] = ['swift'];

export const supportedDatasources = [
  CarthageDatasource.id,
  GitTagsDatasource.id,
  GithubTagsDatasource.id,
  GitlabTagsDatasource.id,
];
