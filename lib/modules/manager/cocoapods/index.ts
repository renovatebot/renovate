import type { Category } from '../../../constants/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import { PodDatasource } from '../../datasource/pod/index.ts';
import * as rubyVersioning from '../../versioning/ruby/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';

export const displayName = 'CocoaPods';
export const url = 'https://cocoapods.org';
export const categories: Category[] = ['swift'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)Podfile$/'],
  versioning: rubyVersioning.id,
};

export const supportedDatasources = [
  GitTagsDatasource.id,
  GithubTagsDatasource.id,
  GitlabTagsDatasource.id,
  PodDatasource.id,
];
