import { GithubReleasesDatasource } from '../../datasource/github-releases';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|\\/)\\.bazelversion$'],
  pinDigests: false,
};

export const supportedDatasources = [GithubReleasesDatasource.id];
