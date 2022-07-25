import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import { PodDatasource } from '../../datasource/pod';
import * as rubyVersioning from '../../versioning/ruby';

export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';

export const displayName = 'CocoaPods';
export const url = 'https://cocoapods.org';

export const defaultConfig = {
  fileMatch: ['(^|/)Podfile$'],
  versioning: rubyVersioning.id,
};

export const supportedDatasources = [
  GitTagsDatasource.id,
  GithubTagsDatasource.id,
  GitlabTagsDatasource.id,
  PodDatasource.id,
];
