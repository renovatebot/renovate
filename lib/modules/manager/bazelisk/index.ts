import { GithubReleasesDatasource } from '../../datasource/github-releases';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)\\.bazelversion$'],
  filePatterns: ['**/.bazelversion'], // not used yet
  pinDigests: false,
};

export const supportedDatasources = [GithubReleasesDatasource.id];
