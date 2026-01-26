import { GithubReleasesDatasource } from '../../datasource/github-releases';

export { extractPackageFile } from './extract';

export const displayName = 'devbox-version';

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.devbox-version$/'],
};

export const supportedDatasources = [GithubReleasesDatasource.id];
