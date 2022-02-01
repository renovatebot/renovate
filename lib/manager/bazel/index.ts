import * as datasourceDocker from '../../datasource/docker';
import * as datasourceGithubReleases from '../../datasource/github-releases';
import * as datasourceGithubTags from '../../datasource/github-tags';
import { GoDatasource } from '../../datasource/go';
import { extractPackageFile } from './extract';
import { updateDependency } from './update';

export { extractPackageFile, updateDependency };

export const defaultConfig = {
  fileMatch: ['(^|/)WORKSPACE(|\\.bazel)$', '\\.bzl$'],
};

export const supportedDatasources = [
  datasourceDocker.id,
  datasourceGithubReleases.id,
  datasourceGithubTags.id,
  GoDatasource.id,
];
