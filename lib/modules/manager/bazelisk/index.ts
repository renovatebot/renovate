import type { Category } from '../../../constants';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import * as semverVersioning from '../../versioning/semver';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)\\.bazelversion$'],
  pinDigests: false,
  versioning: semverVersioning.id,
};

export const categories: Category[] = ['bazel'];

export const supportedDatasources = [GithubTagsDatasource.id];
