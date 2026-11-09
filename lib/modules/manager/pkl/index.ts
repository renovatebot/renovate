import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { extractPackageFile } from './extract.ts';

export { extractPackageFile };

export const displayName = 'Pkl';
export const url =
  'https://pkl-lang.org/main/current/language-reference/index.html#packages';

export const defaultConfig = {
  managerFilePatterns: ['/\\.pkl$/'],
};

export const supportedDatasources = [GithubReleasesDatasource.id];
