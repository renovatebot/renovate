import type { Category } from '../../../constants/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabReleasesDatasource } from '../../datasource/gitlab-releases/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import { GoDatasource } from '../../datasource/go/index.ts';
import { MavenDatasource } from '../../datasource/maven/index.ts';
import { updateArtifacts } from './artifacts.ts';
import { extractPackageFile } from './extract.ts';

export { knownDepTypes } from './dep-types.ts';
export { extractPackageFile, updateArtifacts };

export const url = 'https://bazel.build/docs';
export const categories: Category[] = ['bazel'];

export const defaultConfig = {
  managerFilePatterns: [
    '/(^|/)WORKSPACE(|\\.bazel|\\.bzlmod)$/',
    '/\\.WORKSPACE\\.bazel$/',
    '/\\.bzl$/',
  ],
};

export const supportedDatasources = [
  DockerDatasource.id,
  GithubReleasesDatasource.id,
  GithubTagsDatasource.id,
  GitlabReleasesDatasource.id,
  GitlabTagsDatasource.id,
  GoDatasource.id,
  MavenDatasource.id,
];
