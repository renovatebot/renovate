import { GithubReleasesDatasource } from '../../datasource/github-releases';
import * as semverVersioning from '../../versioning/semver';

export { extractPackageFile } from './extract';

export const displayName = 'devbox-version';

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.devbox-version$/'],
  versioning: semverVersioning.id,
};

export const supportedDatasources = [GithubReleasesDatasource.id];
