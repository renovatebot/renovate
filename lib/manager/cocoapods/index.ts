import { GitTagsDatasource } from '../../datasource/git-tags';
import * as datasourceGithubTags from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import { PodDatasource } from '../../datasource/pod';
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
  GitlabTagsDatasource.id,
  PodDatasource.id,
];
