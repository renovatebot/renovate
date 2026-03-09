import type { Category } from '../../../constants/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import * as semverVersioning from '../../versioning/semver/index.ts';

export { extractPackageFile } from './extract.ts';

export const url = 'https://github.com/bazelbuild/bazelisk';
export const categories: Category[] = ['bazel'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.bazelversion$/'],
  pinDigests: false,
  versioning: semverVersioning.id,
};

export const supportedDatasources = [GithubReleasesDatasource.id];
