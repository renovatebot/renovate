import type { Category } from '../../../constants';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import * as semverVersioning from '../../versioning/semver';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)\\.bazelversion$'],
  pinDigests: false,
  versioning: semverVersioning.id,
};

export const categories: Category[] = ['bazel'];

export const supportedDatasources = [GithubReleasesDatasource.id];
