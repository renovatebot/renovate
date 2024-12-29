import type { Category } from '../../../constants';
import { BazelDatasource } from '../../datasource/bazel';
import { DockerDatasource } from '../../datasource/docker';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { MavenDatasource } from '../../datasource/maven';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const url = 'https://bazel.build/external/module';
export const categories: Category[] = ['bazel'];

export const defaultConfig = {
  fileMatch: ['(^|/|\\.)MODULE\\.bazel$'],
};

export const supportedDatasources = [
  BazelDatasource.id,
  DockerDatasource.id,
  GithubTagsDatasource.id,
  MavenDatasource.id,
];
