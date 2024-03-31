import type { Category } from '../../../constants';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import * as semverVersioning from '../../versioning/semver';

export const supportedDatasources = [
  GithubReleasesDatasource.id,
];

export const defaultConfig = {
  fileMatch: ['\\.scalafmt.conf$'],
  versioning: semverVersioning.id,
};

export const categories: Category[] = ['java'];
