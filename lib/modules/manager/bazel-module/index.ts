import type { Category } from '../../../constants/index.ts';
import { BazelDatasource } from '../../datasource/bazel/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { MavenDatasource } from '../../datasource/maven/index.ts';
import { extractPackageFile } from './extract.ts';

export { extractPackageFile };

export const url = 'https://bazel.build/external/module';
export const categories: Category[] = ['bazel'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/|\\.)MODULE\\.bazel$/'],
};

export const supportedDatasources = [
  BazelDatasource.id,
  DockerDatasource.id,
  GithubTagsDatasource.id,
  MavenDatasource.id,
];
