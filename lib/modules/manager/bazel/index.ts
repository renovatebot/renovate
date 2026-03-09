import type { Category } from '../../../constants/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GoDatasource } from '../../datasource/go/index.ts';
import { updateArtifacts } from './artifacts.ts';
import { extractPackageFile } from './extract.ts';

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
  GoDatasource.id,
];
