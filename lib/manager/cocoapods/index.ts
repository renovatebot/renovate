import { GitTagsDatasource } from '../../datasource/git-tags';
import * as datasourceGithubTags from '../../datasource/github-tags';
import * as datasourceGitlabTags from '../../datasource/gitlab-tags';
import * as datasourcePod from '../../datasource/pod';
import * as rubyVersioning from '../../versioning/ruby';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const defaultConfig = {
  fileMatch: ['(^|/)Podfile$'],
  versioning: rubyVersioning.id,
};

export const supportedDatasources = [
  GitTagsDatasource.id,
  datasourceGithubTags.id,
  datasourceGitlabTags.id,
  datasourcePod.id,
];
