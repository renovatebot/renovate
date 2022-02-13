import * as datasourceDocker from '../../datasource/docker';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GoDatasource } from '../../datasource/go';
import { extractPackageFile } from './extract';
import { updateDependency } from './update';

export { extractPackageFile, updateDependency };

export const defaultConfig = {
  fileMatch: ['(^|/)WORKSPACE(|\\.bazel)$', '\\.bzl$'],
};

export const supportedDatasources = [
  datasourceDocker.id,
  GithubReleasesDatasource.id,
  GithubTagsDatasource.id,
  GoDatasource.id,
];
