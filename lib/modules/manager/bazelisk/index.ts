import type { Category } from '../../../constants';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import * as semverVersioning from '../../versioning/semver';

export { extractPackageFile } from './extract';

export const url = 'https://github.com/bazelbuild/bazelisk';
export const categories: Category[] = ['bazel'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.bazelversion$/'],
  pinDigests: false,
  versioning: semverVersioning.id,
};

export const supportedDatasources = [GithubReleasesDatasource.id];
