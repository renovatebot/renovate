import type { Category } from '../../../constants';
import { BazelDatasource } from '../../datasource/bazel';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)MODULE\\.bazel$'],
};

export const categories: Category[] = ['bazel'];

export const supportedDatasources = [
  BazelDatasource.id,
  GithubTagsDatasource.id,
];
