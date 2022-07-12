import type { Category } from '../../../constants';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import { PodDatasource } from '../../datasource/pod';
import * as rubyVersioning from '../../versioning/ruby';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const displayName = 'CocoaPods';
export const url = 'https://cocoapods.org';

export const defaultConfig = {
  fileMatch: ['(^|/)Podfile$'],
  versioning: rubyVersioning.id,
};

export const categories: Category[] = ['swift'];

export const supportedDatasources = [
  GitTagsDatasource.id,
  GithubTagsDatasource.id,
  GitlabTagsDatasource.id,
  PodDatasource.id,
];
