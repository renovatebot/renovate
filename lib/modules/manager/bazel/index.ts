import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GoDatasource } from '../../datasource/go';
import { updateArtifacts } from './artifacts';
import { extractPackageFile } from './extract';

export { extractPackageFile, updateArtifacts };

export const defaultConfig = {
  fileMatch: ['(^|/)WORKSPACE(|\\.bazel)$', '\\.bzl$'],
};

export const categories: Category[] = ['bazel'];

export const supportedDatasources = [
  DockerDatasource.id,
  GithubReleasesDatasource.id,
  GithubTagsDatasource.id,
  GoDatasource.id,
];
