import * as datasourceDocker from '../../datasource/docker';
import { GitTagsDatasource } from '../../datasource/git-tags';
import * as datasourceGitHubTags from '../../datasource/github-tags';
import { HelmDatasource } from '../../datasource/helm';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)kustomization\\.yaml'],
  pinDigests: false,
};

export const supportedDatasources = [
  datasourceDocker.id,
  GitTagsDatasource.id,
  datasourceGitHubTags.id,
  HelmDatasource.id,
];
